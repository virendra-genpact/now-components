import { createCustomElement, actionTypes } from '@servicenow/ui-core';
import snabbdom from '@servicenow/ui-renderer-snabbdom';
import { createHttpEffect } from '@servicenow/ui-effect-http';
import styles from './styles.scss';

/* ------------------------------------------------------------------ *
 * x-gegis-library-dynamic-form
 *
 * An OOTB-style record form: you configure it with a TABLE, a record
 * SYS_ID and a form VIEW (just like the platform form component). The
 * component then talks to the ServiceNow Table API itself to:
 *   1. load the record values for the view,
 *   2. read field labels / types from `sys_dictionary`,
 *   3. read choice lists from `sys_choice`,
 *   4. read the form layout (sections + field order) from `sys_ui_element`,
 *   5. PATCH changes back on Save (or automatically on blur if Autosave).
 *
 * HTTP is done with `@servicenow/ui-effect-http` (`createHttpEffect`) so the
 * instance session / auth / scope are used automatically — we never hand-roll
 * `fetch()`. Each call chains to the next via dispatched actions.
 *
 * Config (see now-ui.json):
 *   - `table`     (string)  table name, e.g. "incident"
 *   - `sysId`     (string)  record sys_id to load / save
 *   - `view`      (string)  form view name ("" = default view)
 *   - `readOnly`  (boolean) render every field disabled
 *   - `autosave`  (boolean) PATCH the record on field blur / change
 *   - `columns`   (number)  fields per row in each section
 *   - `saveLabel` / `showSave` — manual Save button
 *
 * Lessons applied: `initialState` + `updateState` (no `state` config key);
 * no now-* imports; CSS chevron (no JSX <svg>); defensive parsing throughout.
 * ------------------------------------------------------------------ */

/* ---- action types ---- */
const A = {
	MAYBE_LOAD: 'DF#MAYBE_LOAD',
	FETCH_VIEW_NAME: 'DF#FETCH_VIEW_NAME',
	VIEW_NAME_OK: 'DF#VIEW_NAME_OK',
	VIEW_NAME_ERR: 'DF#VIEW_NAME_ERR',
	FETCH_RECORD: 'DF#FETCH_RECORD',
	RECORD_OK: 'DF#RECORD_OK',
	RECORD_ERR: 'DF#RECORD_ERR',
	FETCH_DICT: 'DF#FETCH_DICT',
	DICT_OK: 'DF#DICT_OK',
	DICT_ERR: 'DF#DICT_ERR',
	RESOLVE_DW: 'DF#RESOLVE_DW',
	FETCH_MORE_DICTS: 'DF#FETCH_MORE_DICTS',
	MORE_DICTS_OK: 'DF#MORE_DICTS_OK',
	MORE_DICTS_ERR: 'DF#MORE_DICTS_ERR',
	FETCH_CHOICES: 'DF#FETCH_CHOICES',
	CHOICES_OK: 'DF#CHOICES_OK',
	CHOICES_ERR: 'DF#CHOICES_ERR',
	FETCH_LAYOUT: 'DF#FETCH_LAYOUT',
	LAYOUT_OK: 'DF#LAYOUT_OK',
	LAYOUT_ERR: 'DF#LAYOUT_ERR',
	SAVE: 'DF#SAVE',
	SAVE_OK: 'DF#SAVE_OK',
	SAVE_ERR: 'DF#SAVE_ERR',
};

/* ---- helpers ---- */

// Unwrap the `result` payload from an http-effect success action, defensively.
const resultOf = (action) => {
	const p = (action && action.payload) || {};
	if (p.result !== undefined) return p.result;
	if (p.data && p.data.result !== undefined) return p.data.result;
	if (p.body && p.body.result !== undefined) return p.body.result;
	return [];
};

const errOf = (action) => {
	const p = (action && action.payload) || {};
	if (p.error && p.error.message) return p.error.message;
	if (p.statusText) return p.statusText;
	if (p.message) return p.message;
	return 'Request failed';
};

// sysparm_display_value=all returns { value, display_value } per field.
const rawVal = (cell) => (cell && typeof cell === 'object' ? cell.value : cell);
const dispVal = (cell) => (cell && typeof cell === 'object' ? cell.display_value : cell);

// Map a sys_dictionary internal_type display string to a render kind.
const normType = (disp) => {
	const t = String(disp || '').toLowerCase();
	if (t.includes('true/false') || t.includes('boolean')) return 'boolean';
	if (t.includes('reference') || t.includes('document id') || t.includes('glide list') || t.includes('list'))
		return 'reference';
	if (t.includes('integer') || t.includes('long') || t.includes('decimal') || t.includes('float') || t.includes('currency') || t.includes('percent') || t.includes('numeric'))
		return 'number';
	if (t.includes('date/time') || t.includes('time')) return 'datetime';
	if (t.includes('date')) return 'date';
	if (t.includes('html') || t.includes('journal') || t.includes('translated')) return 'textarea';
	if (t.includes('choice')) return 'choice';
	return 'string';
};

// A 32-char hex string is a sys_id; anything else is treated as a view name.
const isSysId = (v) => /^[0-9a-f]{32}$/i.test(String(v || ''));

// Filter sys_ui_section by the resolved view NAME (empty = Default view).
const VIEW_QUERY = (viewName) =>
	viewName ? `^sys_ui_section.view.name=${viewName}` : '^sys_ui_section.viewISEMPTY';

// Parse sys_dictionary rows into field metadata. byTable=false -> { col -> meta }
// (single table); byTable=true -> { table -> { col -> meta } } (multi-table).
const dictFromRows = (rows, byTable) => {
	const out = {};
	(Array.isArray(rows) ? rows : []).forEach((r) => {
		const col = rawVal(r.element);
		if (!col) return;
		const meta = {
			label: dispVal(r.column_label) || rawVal(r.column_label) || col,
			type: normType(dispVal(r.internal_type) || rawVal(r.internal_type)),
			reference: rawVal(r.reference) || '',
			mandatory: rawVal(r.mandatory) === 'true' || rawVal(r.mandatory) === true,
			readonly: rawVal(r.read_only) === 'true' || rawVal(r.read_only) === true,
		};
		if (byTable) {
			const t = rawVal(r.name);
			(out[t] = out[t] || {})[col] = meta;
		} else {
			out[col] = meta;
		}
	});
	return out;
};

// Humanize a column name when no dictionary label is available.
const prettify = (s) =>
	String(s || '')
		.replace(/_/g, ' ')
		.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
		.replace(/\b\w/g, (c) => c.toUpperCase());

/* Resolve a (possibly dot-walked) field name to its FINAL table + column using
 * the per-table dictionaries. e.g. "broker.brokeraddress.address1" walks the
 * `broker` then `brokeraddress` reference targets to the table that owns
 * `address1`. Returns { table, col, meta }. */
const resolveField = (dicts, baseTable, name) => {
	const segs = String(name).split('.');
	let cur = baseTable;
	for (let i = 0; i < segs.length - 1; i++) {
		const e = dicts[cur] && dicts[cur][segs[i]];
		if (!e || !e.reference) {
			cur = null;
			break;
		}
		cur = e.reference;
	}
	const col = segs[segs.length - 1];
	const meta = (cur && dicts[cur] && dicts[cur][col]) || null;
	return { table: cur, col, meta };
};

/* ------------------------------------------------------------------ *
 * Build the render model from the fetched pieces.
 * ------------------------------------------------------------------ */
const assemble = (state) => {
	const dicts = state._dicts || {}; // table -> { col -> { label, type, reference, ... } }
	const baseTable = state._baseTable || '';
	const choices = state._choices || {}; // "table.col" -> [{label,value}]
	const record = state._record || {}; // name -> { value, display_value }
	const layout = Array.isArray(state._layout) ? state._layout : [];

	const fieldNames = Object.keys(record);
	const inRecord = new Set(fieldNames);

	const makeField = (name) => {
		const { table, col, meta } = resolveField(dicts, baseTable, name);
		const ck = table ? `${table}.${col}` : '';
		const hasChoices = ck && Array.isArray(choices[ck]) && choices[ck].length > 0;
		let type = (meta && meta.type) || 'string';
		if (hasChoices) type = 'choice';
		return {
			name, // original (possibly dot-walked) key — used for values
			label: (meta && meta.label) || prettify(col),
			type,
			choices: hasChoices ? choices[ck] : [],
			mandatory: !!(meta && meta.mandatory),
			readonly: !!(meta && meta.readonly),
			dotwalk: name.indexOf('.') >= 0,
		};
	};

	let sections = [];

	// Prefer the real form layout (sections + order) when available.
	const usable = layout.filter((r) => {
		const el = rawVal(r.element);
		return el && !String(el).startsWith('.') && inRecord.has(el);
	});

	if (usable.length) {
		const order = [];
		const bySection = {};
		usable.forEach((r) => {
			const secName = dispVal(r.sys_ui_section) || 'Details';
			if (!bySection[secName]) {
				bySection[secName] = [];
				order.push(secName);
			}
			bySection[secName].push(makeField(rawVal(r.element)));
		});
		sections = order.map((sectionName) => ({ sectionName, fields: bySection[sectionName] }));
	} else {
		// Fallback: one section from the view's returned fields.
		sections = [
			{
				sectionName: '',
				fields: fieldNames
					.filter((n) => n !== 'sys_id')
					.map(makeField),
			},
		];
	}

	// Seed editable values + display values from the record.
	const values = {};
	const display = {};
	fieldNames.forEach((n) => {
		values[n] = rawVal(record[n]);
		display[n] = dispVal(record[n]);
	});

	return { model: { sections }, values, display };
};

/* ------------------------------------------------------------------ *
 * Kick off the load chain when table/sysId/view are present & changed.
 * ------------------------------------------------------------------ */
// Fetch the record for a (already-resolved) view NAME, then chain dict/choices/layout.
const startRecordLoad = (dispatch, table, sysId, viewName) => {
	const payload = { table, sysId, sysparm_display_value: 'all' };
	if (viewName) payload.sysparm_view = viewName; // Table API filters fields to the view
	dispatch(A.FETCH_RECORD, payload);
};

const maybeLoad = ({ state, updateState, dispatch }) => {
	const { table, sysId, view } = state.properties;
	if (!table || !sysId) return;
	const key = `${table}|${sysId}|${view || ''}`;
	if (key === state._loadedKey) return;
	updateState({ _loadedKey: key, loading: true, error: '', _layout: [], _viewName: '' });

	// `view` may be a sys_id or a name. sysparm_view + the section query both need
	// the NAME, so resolve a sys_id to its name first; otherwise use it directly.
	if (view && isSysId(view)) {
		dispatch(A.FETCH_VIEW_NAME, { viewSysId: view, sysparm_fields: 'name' });
	} else {
		updateState({ _viewName: view || '' });
		startRecordLoad(dispatch, table, sysId, view || '');
	}
};

/* A field changed (from a now-* control's dispatched action). Update the
 * editable value + dirty set, notify, and autosave on blur/change if enabled. */
const applyFieldChange = ({ state, updateState, dispatch }, name, value) => {
	if (!name) return;
	const values = { ...(state.values || {}), [name]: value };
	const dirty = { ...(state.dirty || {}), [name]: value };
	updateState({ values, dirty });
	dispatch('FIELD_CHANGED', { name, value: String(value == null ? '' : value) });
	if (state.properties.autosave) dispatch(A.SAVE, { fields: { [name]: value } });
};

/* ------------------------------------------------------------------ *
 * View
 * ------------------------------------------------------------------ */
const view = (state) => {
	const {
		readOnly, columns, saveLabel, showSave, autosave, table, sysId,
		heading, subheading, saveButtonPosition,
	} = state.properties;
	const { loading, error, saving, model, values, display } = state;
	const secs = (model && Array.isArray(model.sections)) ? model.sections : [];
	const cols = Number(columns) > 0 ? Number(columns) : 2;
	const gridStyle = { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` };

	const valStr = (nm) => String(values && values[nm] != null ? values[nm] : '');
	const fieldDisabled = (f) => !!readOnly || !!f.readonly || saving;

	// Each field is a real Horizon now-* control composed inside our card layout.
	// Change tracking: now-input/now-textarea/now-checkbox carry `name` in their
	// dispatched action; now-select does not, so we encode the field into each
	// item id ("field::value") and decode it in the NOW_SELECT handler.
	const renderField = (f) => {
		const nm = f.name;
		const disabled = fieldDisabled(f);

		if (f.type === 'choice') {
			const items = [{ id: `${nm}::`, label: '— None —' }].concat(
				(f.choices || []).map((o) => ({ id: `${nm}::${o.value}`, label: o.label }))
			);
			return (
				<div className="ff-field">
					<now-select
						label={f.label}
						items={items}
						selectedItem={`${nm}::${valStr(nm)}`}
						required={f.mandatory}
						disabled={disabled}
						search="contains"
					/>
				</div>
			);
		}

		if (f.type === 'boolean') {
			const v = valStr(nm);
			return (
				<div className="ff-field ff-field--bool">
					<now-checkbox
						name={nm}
						label={f.label}
						checked={v === 'true' || v === '1'}
						disabled={disabled}
						required={f.mandatory}
					/>
				</div>
			);
		}

		if (f.type === 'reference') {
			// Editing references needs a record picker we don't have over plain
			// REST, so references are shown read-only (display value). See README.
			return (
				<div className="ff-field">
					<now-input
						name={nm}
						label={f.label}
						value={String((display && display[nm]) || valStr(nm))}
						readonly={true}
					/>
				</div>
			);
		}

		if (f.type === 'textarea') {
			return (
				<div className="ff-field ff-field--wide">
					<now-textarea
						name={nm}
						label={f.label}
						value={valStr(nm)}
						disabled={disabled}
						required={f.mandatory}
					/>
				</div>
			);
		}

		if (f.type === 'date' || f.type === 'datetime') {
			const isDt = f.type === 'datetime';
			return (
				<div className="ff-field">
					<now-date-time
						name={nm}
						label={f.label}
						type={isDt ? 'date-time' : 'date'}
						format={isDt ? 'yyyy-MM-dd HH:mm:ss' : 'yyyy-MM-dd'}
						value={valStr(nm)}
						disabled={disabled}
						required={f.mandatory}
					/>
				</div>
			);
		}

		return (
			<div className="ff-field">
				<now-input
					name={nm}
					label={f.label}
					type={f.type === 'number' ? 'number' : 'text'}
					value={valStr(nm)}
					disabled={disabled}
					required={f.mandatory}
				/>
			</div>
		);
	};

	const saveBtn = () => (
		<div className="ff-actions">
			{autosave ? <span className="ff-autosave">Autosave on</span> : null}
			<now-button label={saving ? 'Saving…' : (saveLabel || 'Save')} variant="primary" disabled={saving} />
		</div>
	);

	const header = (heading || subheading) ? (
		<div className="ff-titles">
			{heading ? <div className="ff-heading">{heading}</div> : null}
			{subheading ? <div className="ff-subheading">{subheading}</div> : null}
		</div>
	) : null;

	if (!table || !sysId) {
		return (
			<div className="ff-root">
				{header}
				<div className="ff-msg">Configure a <b>Table</b> and <b>Record sys_id</b> to load the form.</div>
			</div>
		);
	}

	if (loading) {
		return (
			<div className="ff-root">
				{header}
				<div className="ff-loading"><now-loader label="Loading…" size="lg" /></div>
			</div>
		);
	}

	const buttons = showSave && !readOnly && secs.length;
	const pos = saveButtonPosition || 'bottom';
	const showTop = buttons && (pos === 'top' || pos === 'both');
	const showBottom = buttons && (pos === 'bottom' || pos === 'both');

	return (
		<div className="ff-root">
			{(header || showTop) ? (
				<div className="ff-topbar">
					{header || <span></span>}
					{showTop ? saveBtn() : null}
				</div>
			) : null}

			{error ? <div className="ff-error" role="alert">{error}</div> : null}

			{secs.map((sec) => (
				<div className="ff-card">
					{sec.sectionName ? <div className="ff-section-title">{sec.sectionName}</div> : null}
					<div className="ff-grid" style={gridStyle}>
						{(sec.fields || []).map((f) => renderField(f))}
					</div>
				</div>
			))}

			{showBottom ? saveBtn() : null}
		</div>
	);
};

/* ------------------------------------------------------------------ *
 * Element
 * ------------------------------------------------------------------ */
createCustomElement('x-gegis-library-dynamic-form', {
	renderer: { type: snabbdom },
	view,
	styles,
	initialState: {
		loading: false,
		saving: false,
		error: '',
		model: { sections: [] },
		values: {},
		display: {},
		dirty: {},
		_viewName: '',
		_loadedKey: '',
		_dicts: {},
		_baseTable: '',
		_dwTried: [],
		_choices: {},
		_record: {},
		_layout: [],
	},
	properties: {
		table: { default: '' },
		sysId: { default: '' },
		view: { default: '' },
		heading: { default: '' },
		subheading: { default: '' },
		readOnly: { default: false },
		autosave: { default: false },
		columns: { default: 2 },
		saveLabel: { default: 'Save' },
		showSave: { default: true },
		saveButtonPosition: { default: 'bottom' },
	},
	actionHandlers: {
		[actionTypes.COMPONENT_BOOTSTRAPPED]: maybeLoad,
		[actionTypes.COMPONENT_CONNECTED]: maybeLoad,
		[actionTypes.COMPONENT_PROPERTY_CHANGED]: (coeffects) => {
			const { action } = coeffects;
			const name = action && action.payload ? action.payload.propertyName : '';
			if (name === 'table' || name === 'sysId' || name === 'view') maybeLoad(coeffects);
		},

		/* ---- field changes from the composed now-* controls ---- */
		'NOW_INPUT#VALUE_SET': (cx) => applyFieldChange(cx, cx.action.payload.name, cx.action.payload.value),
		'NOW_TEXTAREA#VALUE_SET': (cx) => applyFieldChange(cx, cx.action.payload.name, cx.action.payload.value),
		'NOW_DATE_TIME#VALUE_SET': (cx) => applyFieldChange(cx, cx.action.payload.name, cx.action.payload.value),
		'NOW_CHECKBOX#CHECKED_SET': (cx) =>
			applyFieldChange(cx, cx.action.payload.name, cx.action.payload.value ? 'true' : 'false'),
		'NOW_SELECT#SELECTED_ITEM_SET': (cx) => {
			// item id is encoded as "field::value" (see renderField).
			const raw = String((cx.action.payload && cx.action.payload.value) || '');
			const i = raw.indexOf('::');
			applyFieldChange(cx, i >= 0 ? raw.slice(0, i) : '', i >= 0 ? raw.slice(i + 2) : raw);
		},
		'NOW_BUTTON#CLICKED': ({ state, dispatch }) =>
			dispatch(A.SAVE, { fields: { ...(state.dirty || {}) } }),

		/* 0) resolve a view sys_id -> its name (sysparm_view + section query need the name) */
		[A.FETCH_VIEW_NAME]: createHttpEffect('/api/now/table/sys_ui_view/:viewSysId', {
			method: 'GET',
			pathParams: ['viewSysId'],
			queryParams: ['sysparm_fields'],
			successActionType: A.VIEW_NAME_OK,
			errorActionType: A.VIEW_NAME_ERR,
		}),
		[A.VIEW_NAME_OK]: ({ action, state, updateState, dispatch }) => {
			const rec = resultOf(action) || {};
			const viewName = rawVal(rec.name) || '';
			updateState({ _viewName: viewName });
			startRecordLoad(dispatch, state.properties.table, state.properties.sysId, viewName);
		},
		[A.VIEW_NAME_ERR]: ({ state, updateState, dispatch }) => {
			// Couldn't resolve the sys_id — load the Default view rather than break.
			updateState({ _viewName: '' });
			startRecordLoad(dispatch, state.properties.table, state.properties.sysId, '');
		},

		/* 1) record values for the view */
		[A.FETCH_RECORD]: createHttpEffect('/api/now/table/:table/:sysId', {
			method: 'GET',
			pathParams: ['table', 'sysId'],
			queryParams: ['sysparm_display_value', 'sysparm_view'],
			successActionType: A.RECORD_OK,
			errorActionType: A.RECORD_ERR,
		}),
		[A.RECORD_OK]: ({ action, state, updateState, dispatch }) => {
			const rec = resultOf(action) || {};
			updateState({ _record: rec });
			const table = state.properties.table;
			dispatch(A.FETCH_DICT, {
				sysparm_query: `name=${table}^elementISNOTEMPTY`,
				sysparm_fields: 'name,element,column_label,internal_type,reference,mandatory,read_only',
				sysparm_display_value: 'all',
				sysparm_limit: '5000',
			});
		},
		[A.RECORD_ERR]: ({ action, updateState }) =>
			updateState({ loading: false, error: `Could not load record: ${errOf(action)}` }),

		/* 2) field labels + types from sys_dictionary (base table) */
		[A.FETCH_DICT]: createHttpEffect('/api/now/table/sys_dictionary', {
			method: 'GET',
			queryParams: ['sysparm_query', 'sysparm_fields', 'sysparm_display_value', 'sysparm_limit'],
			successActionType: A.DICT_OK,
			errorActionType: A.DICT_ERR,
		}),
		[A.DICT_OK]: ({ action, state, updateState, dispatch }) => {
			const base = state.properties.table;
			updateState({ _dicts: { [base]: dictFromRows(resultOf(action)) }, _baseTable: base, _dwTried: [] });
			dispatch(A.RESOLVE_DW);
		},
		[A.DICT_ERR]: ({ action, updateState }) =>
			updateState({ loading: false, error: `Could not read field metadata: ${errOf(action)}` }),

		/* 2b) resolve dot-walked fields by fetching the related tables' dictionaries */
		[A.RESOLVE_DW]: ({ state, updateState, dispatch }) => {
			const dicts = state._dicts || {};
			const base = state._baseTable;
			const tried = state._dwTried || [];
			const record = state._record || {};
			const needed = new Set();
			Object.keys(record).forEach((name) => {
				if (name.indexOf('.') < 0) return;
				const segs = name.split('.');
				let cur = base;
				for (let i = 0; i < segs.length - 1; i++) {
					const e = dicts[cur] && dicts[cur][segs[i]];
					if (!e || !e.reference) break;
					const next = e.reference;
					if (!dicts[next]) {
						if (tried.indexOf(next) < 0) needed.add(next);
						break;
					}
					cur = next;
				}
			});
			if (needed.size) {
				const tables = Array.from(needed);
				updateState({ _dwTried: tried.concat(tables) });
				dispatch(A.FETCH_MORE_DICTS, {
					sysparm_query: `nameIN${tables.join(',')}^elementISNOTEMPTY`,
					sysparm_fields: 'name,element,column_label,internal_type,reference,mandatory,read_only',
					sysparm_display_value: 'all',
					sysparm_limit: '8000',
				});
			} else {
				dispatch(A.FETCH_CHOICES, {
					sysparm_query: `nameIN${Object.keys(dicts).join(',')}^inactive=false^ORDERBYelement^ORDERBYsequence`,
					sysparm_fields: 'name,element,label,value',
					sysparm_limit: '8000',
				});
			}
		},
		[A.FETCH_MORE_DICTS]: createHttpEffect('/api/now/table/sys_dictionary', {
			method: 'GET',
			queryParams: ['sysparm_query', 'sysparm_fields', 'sysparm_display_value', 'sysparm_limit'],
			successActionType: A.MORE_DICTS_OK,
			errorActionType: A.MORE_DICTS_ERR,
		}),
		[A.MORE_DICTS_OK]: ({ action, state, updateState, dispatch }) => {
			const dicts = { ...(state._dicts || {}) };
			const byTable = dictFromRows(resultOf(action), true);
			Object.keys(byTable).forEach((t) => {
				dicts[t] = Object.assign({}, dicts[t], byTable[t]);
			});
			updateState({ _dicts: dicts });
			dispatch(A.RESOLVE_DW);
		},
		[A.MORE_DICTS_ERR]: ({ dispatch }) => dispatch(A.RESOLVE_DW),

		/* 3) choice lists from sys_choice (all involved tables), keyed "table.col" */
		[A.FETCH_CHOICES]: createHttpEffect('/api/now/table/sys_choice', {
			method: 'GET',
			queryParams: ['sysparm_query', 'sysparm_fields', 'sysparm_limit'],
			successActionType: A.CHOICES_OK,
			errorActionType: A.CHOICES_ERR,
		}),
		[A.CHOICES_OK]: ({ action, state, updateState, dispatch }) => {
			const rows = resultOf(action) || [];
			const choices = {};
			rows.forEach((r) => {
				const tbl = rawVal(r.name);
				const el = rawVal(r.element);
				if (!el) return;
				const k = `${tbl}.${el}`;
				(choices[k] = choices[k] || []).push({ label: rawVal(r.label), value: rawVal(r.value) });
			});
			updateState({ _choices: choices });
			const table = state.properties.table;
			dispatch(A.FETCH_LAYOUT, {
				sysparm_query: `sys_ui_section.name=${table}${VIEW_QUERY(state._viewName)}^ORDERBYposition`,
				sysparm_fields: 'element,position,type,sys_ui_section',
				sysparm_display_value: 'all',
				sysparm_limit: '500',
			});
		},
		[A.CHOICES_ERR]: ({ state, updateState, dispatch }) => {
			// Non-critical — proceed to layout.
			updateState({ _choices: {} });
			const table = state.properties.table;
			dispatch(A.FETCH_LAYOUT, {
				sysparm_query: `sys_ui_section.name=${table}${VIEW_QUERY(state._viewName)}^ORDERBYposition`,
				sysparm_fields: 'element,position,type,sys_ui_section',
				sysparm_display_value: 'all',
				sysparm_limit: '500',
			});
		},

		/* 4) form layout (sections + order) from sys_ui_element */
		[A.FETCH_LAYOUT]: createHttpEffect('/api/now/table/sys_ui_element', {
			method: 'GET',
			queryParams: ['sysparm_query', 'sysparm_fields', 'sysparm_display_value', 'sysparm_limit'],
			successActionType: A.LAYOUT_OK,
			errorActionType: A.LAYOUT_ERR,
		}),
		[A.LAYOUT_OK]: ({ action, state, updateState }) => {
			const rows = resultOf(action) || [];
			const next = { ...state, _layout: rows };
			updateState({ _layout: rows, loading: false, ...assemble(next) });
		},
		[A.LAYOUT_ERR]: ({ state, updateState }) => {
			// Non-critical — assemble with no layout (single-section fallback).
			const next = { ...state, _layout: [] };
			updateState({ _layout: [], loading: false, ...assemble(next) });
		},

		/* Save: PATCH the dirty fields back to the record. Dot-walked fields belong
		 * to RELATED records, so the base-table PATCH can't write them — drop them
		 * (otherwise the whole save would fail). See README limitations. */
		[A.SAVE]: ({ action, state, updateState, dispatch }) => {
			const all = (action.payload && action.payload.fields) || {};
			const fields = {};
			Object.keys(all).forEach((k) => {
				if (k.indexOf('.') < 0) fields[k] = all[k];
			});
			if (!Object.keys(fields).length) return;
			updateState({ saving: true, error: '' });
			const { table, sysId } = state.properties;
			dispatch('DF#SAVE_HTTP', { table, sysId, data: fields, sysparm_display_value: 'all' });
		},
		'DF#SAVE_HTTP': createHttpEffect('/api/now/table/:table/:sysId', {
			method: 'PATCH',
			pathParams: ['table', 'sysId'],
			dataParam: 'data',
			queryParams: ['sysparm_display_value'],
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			successActionType: A.SAVE_OK,
			errorActionType: A.SAVE_ERR,
		}),
		[A.SAVE_OK]: ({ action, state, updateState, dispatch }) => {
			const rec = resultOf(action) || {};
			const values = { ...(state.values || {}) };
			const display = { ...(state.display || {}) };
			Object.keys(rec).forEach((n) => {
				values[n] = rawVal(rec[n]);
				display[n] = dispVal(rec[n]);
			});
			updateState({ saving: false, dirty: {}, values, display, _record: rec });
			dispatch('FORM_SAVED', { table: state.properties.table, sysId: state.properties.sysId });
		},
		[A.SAVE_ERR]: ({ action, updateState, dispatch }) => {
			const message = errOf(action);
			updateState({ saving: false, error: `Save failed: ${message}` });
			dispatch('SAVE_ERROR', { message });
		},
	},
});
