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
	FETCH_RECORD: 'DF#FETCH_RECORD',
	RECORD_OK: 'DF#RECORD_OK',
	RECORD_ERR: 'DF#RECORD_ERR',
	FETCH_DICT: 'DF#FETCH_DICT',
	DICT_OK: 'DF#DICT_OK',
	DICT_ERR: 'DF#DICT_ERR',
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

// Filter sys_ui_section by view: match the reference directly when given a
// sys_id, dot-walk to .name when given a name, or empty for the Default view.
const VIEW_QUERY = (view) => {
	if (!view) return '^sys_ui_section.viewISEMPTY';
	return isSysId(view) ? `^sys_ui_section.view=${view}` : `^sys_ui_section.view.name=${view}`;
};

/* ------------------------------------------------------------------ *
 * Build the render model from the four fetched pieces.
 * ------------------------------------------------------------------ */
const assemble = (state) => {
	const dict = state._dict || {}; // name -> { label, type, mandatory, readonly }
	const choices = state._choices || {}; // name -> [{label,value}]
	const record = state._record || {}; // name -> { value, display_value }
	const layout = Array.isArray(state._layout) ? state._layout : [];

	const fieldNames = Object.keys(record);
	const inRecord = new Set(fieldNames);

	const makeField = (name) => {
		const d = dict[name] || {};
		const hasChoices = Array.isArray(choices[name]) && choices[name].length > 0;
		let type = d.type || 'string';
		if (hasChoices) type = 'choice';
		return {
			name,
			label: d.label || name,
			type,
			choices: hasChoices ? choices[name] : [],
			mandatory: !!d.mandatory,
			readonly: !!d.readonly,
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
const maybeLoad = ({ state, updateState, dispatch }) => {
	const { table, sysId, view } = state.properties;
	if (!table || !sysId) return;
	const key = `${table}|${sysId}|${view || ''}`;
	if (key === state._loadedKey) return;
	updateState({ _loadedKey: key, loading: true, error: '', _layout: [] });
	const payload = { table, sysId, sysparm_display_value: 'all' };
	// sysparm_view accepts a view NAME only; with a sys_id we fetch all fields
	// and let the (sys_id-matched) layout select which fields render.
	if (view && !isSysId(view)) payload.sysparm_view = view;
	dispatch(A.FETCH_RECORD, payload);
};

/* ------------------------------------------------------------------ *
 * View
 * ------------------------------------------------------------------ */
const view = (state, { updateState, dispatch }) => {
	const { readOnly, columns, saveLabel, showSave, autosave, table, sysId } = state.properties;
	const { loading, error, saving, model, values, display, dirty } = state;
	const secs = (model && Array.isArray(model.sections)) ? model.sections : [];
	const cols = Number(columns) > 0 ? Number(columns) : 2;
	const gridStyle = { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` };

	const commit = (name, v) => {
		const nextVals = { ...(values || {}), [name]: v };
		const nextDirty = { ...(dirty || {}), [name]: v };
		updateState({ values: nextVals, dirty: nextDirty });
		dispatch('FIELD_CHANGED', { name, value: String(v == null ? '' : v) });
		if (autosave) dispatch(A.SAVE, { fields: { [name]: v } });
	};

	const fieldDisabled = (f) => !!readOnly || !!f.readonly || saving;

	const renderField = (f) => {
		const nm = f.name;
		const val = values && values[nm] != null ? values[nm] : '';
		const disabled = fieldDisabled(f);
		const label = (
			<label className="ff-label">
				{f.label}
				{f.mandatory ? <span className="ff-req" aria-hidden="true"> *</span> : null}
			</label>
		);

		if (f.type === 'choice') {
			return (
				<div className="ff-field">
					{label}
					<span className="ff-select-wrap">
						<select
							className={`ff-select${disabled ? ' ff-control--ro' : ''}`}
							disabled={disabled}
							value={String(val)}
							on-change={(e) => commit(nm, e && e.target ? e.target.value : '')}
						>
							<option value=""></option>
							{f.choices.map((o) => (
								<option value={String(o.value)}>{o.label}</option>
							))}
						</select>
						<span className="ff-chev" aria-hidden="true"></span>
					</span>
				</div>
			);
		}

		if (f.type === 'boolean') {
			const checked = val === true || val === 'true' || val === '1';
			return (
				<div className="ff-field ff-field--bool">
					<label className="ff-check">
						<input
							type="checkbox"
							checked={checked}
							disabled={disabled}
							on-change={(e) => commit(nm, e && e.target && e.target.checked ? 'true' : 'false')}
						/>
						<span>{f.label}{f.mandatory ? ' *' : ''}</span>
					</label>
				</div>
			);
		}

		if (f.type === 'reference') {
			// Editing references needs a record picker we don't have over plain
			// REST, so references are shown read-only (display value). See README.
			return (
				<div className="ff-field">
					{label}
					<input
						className="ff-input ff-control--ro"
						type="text"
						value={String((display && display[nm]) || val || '')}
						disabled={true}
						title="Reference fields are read-only in this component"
					/>
				</div>
			);
		}

		if (f.type === 'textarea') {
			return (
				<div className="ff-field ff-field--wide">
					{label}
					<textarea
						className={`ff-input ff-textarea${disabled ? ' ff-control--ro' : ''}`}
						disabled={disabled}
						on-change={(e) => commit(nm, e && e.target ? e.target.value : '')}
					>{String(val)}</textarea>
				</div>
			);
		}

		const inputType = f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text';
		return (
			<div className="ff-field">
				{label}
				<input
					className={`ff-input${disabled ? ' ff-control--ro' : ''}`}
					type={inputType}
					value={String(val)}
					disabled={disabled}
					on-change={(e) => commit(nm, e && e.target ? e.target.value : '')}
				/>
			</div>
		);
	};

	const onSave = () => dispatch(A.SAVE, { fields: { ...(dirty || {}) } });

	if (!table || !sysId) {
		return (
			<div className="ff-root">
				<div className="ff-msg">Configure a <b>Table</b> and <b>Record sys_id</b> to load the form.</div>
			</div>
		);
	}

	if (loading) {
		return (
			<div className="ff-root">
				<div className="ff-msg">Loading {table}…</div>
			</div>
		);
	}

	return (
		<div className="ff-root">
			{error ? <div className="ff-error" role="alert">{error}</div> : null}

			{secs.map((sec) => (
				<div className="ff-card">
					{sec.sectionName ? <div className="ff-section-title">{sec.sectionName}</div> : null}
					<div className="ff-grid" style={gridStyle}>
						{(sec.fields || []).map((f) => renderField(f))}
					</div>
				</div>
			))}

			{showSave && !readOnly && secs.length ? (
				<div className="ff-actions">
					{autosave ? <span className="ff-autosave">Autosave on</span> : null}
					<button type="button" className="ff-save" disabled={saving} on-click={onSave}>
						{saving ? 'Saving…' : (saveLabel || 'Save')}
					</button>
				</div>
			) : null}
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
		_loadedKey: '',
		_dict: {},
		_choices: {},
		_record: {},
		_layout: [],
	},
	properties: {
		table: { default: '' },
		sysId: { default: '' },
		view: { default: '' },
		readOnly: { default: false },
		autosave: { default: false },
		columns: { default: 2 },
		saveLabel: { default: 'Save' },
		showSave: { default: true },
	},
	actionHandlers: {
		[actionTypes.COMPONENT_BOOTSTRAPPED]: maybeLoad,
		[actionTypes.COMPONENT_CONNECTED]: maybeLoad,
		[actionTypes.COMPONENT_PROPERTY_CHANGED]: (coeffects) => {
			const { action } = coeffects;
			const name = action && action.payload ? action.payload.propertyName : '';
			if (name === 'table' || name === 'sysId' || name === 'view') maybeLoad(coeffects);
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
				sysparm_fields: 'element,column_label,internal_type,mandatory,read_only',
				sysparm_display_value: 'all',
				sysparm_limit: '2000',
			});
		},
		[A.RECORD_ERR]: ({ action, updateState }) =>
			updateState({ loading: false, error: `Could not load record: ${errOf(action)}` }),

		/* 2) field labels + types from sys_dictionary */
		[A.FETCH_DICT]: createHttpEffect('/api/now/table/sys_dictionary', {
			method: 'GET',
			queryParams: ['sysparm_query', 'sysparm_fields', 'sysparm_display_value', 'sysparm_limit'],
			successActionType: A.DICT_OK,
			errorActionType: A.DICT_ERR,
		}),
		[A.DICT_OK]: ({ action, state, updateState, dispatch }) => {
			const rows = resultOf(action) || [];
			const dict = {};
			rows.forEach((r) => {
				const name = rawVal(r.element);
				if (!name) return;
				dict[name] = {
					label: dispVal(r.column_label) || rawVal(r.column_label) || name,
					type: normType(dispVal(r.internal_type) || rawVal(r.internal_type)),
					mandatory: rawVal(r.mandatory) === 'true' || rawVal(r.mandatory) === true,
					readonly: rawVal(r.read_only) === 'true' || rawVal(r.read_only) === true,
				};
			});
			updateState({ _dict: dict });
			const table = state.properties.table;
			dispatch(A.FETCH_CHOICES, {
				sysparm_query: `name=${table}^inactive=false^ORDERBYelement^ORDERBYsequence`,
				sysparm_fields: 'element,label,value',
				sysparm_limit: '5000',
			});
		},
		[A.DICT_ERR]: ({ action, updateState }) =>
			updateState({ loading: false, error: `Could not read field metadata: ${errOf(action)}` }),

		/* 3) choice lists from sys_choice */
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
				const el = rawVal(r.element);
				if (!el) return;
				(choices[el] = choices[el] || []).push({ label: rawVal(r.label), value: rawVal(r.value) });
			});
			updateState({ _choices: choices });
			const { table, view } = state.properties;
			dispatch(A.FETCH_LAYOUT, {
				sysparm_query: `sys_ui_section.name=${table}${VIEW_QUERY(view)}^ORDERBYposition`,
				sysparm_fields: 'element,position,type,sys_ui_section',
				sysparm_display_value: 'all',
				sysparm_limit: '500',
			});
		},
		[A.CHOICES_ERR]: ({ state, updateState, dispatch }) => {
			// Non-critical — proceed to layout.
			updateState({ _choices: {} });
			const { table, view } = state.properties;
			dispatch(A.FETCH_LAYOUT, {
				sysparm_query: `sys_ui_section.name=${table}${VIEW_QUERY(view)}^ORDERBYposition`,
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

		/* Save: PATCH the dirty fields back to the record */
		[A.SAVE]: ({ action, state, updateState, dispatch }) => {
			const fields = (action.payload && action.payload.fields) || {};
			if (!Object.keys(fields).length) return;
			updateState({ saving: true, error: '' });
			const { table, sysId } = state.properties;
			dispatch('DF#SAVE_HTTP', { table, sysId, data: fields });
		},
		'DF#SAVE_HTTP': createHttpEffect('/api/now/table/:table/:sysId', {
			method: 'PATCH',
			pathParams: ['table', 'sysId'],
			dataParam: 'data',
			queryParams: ['sysparm_display_value'],
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
