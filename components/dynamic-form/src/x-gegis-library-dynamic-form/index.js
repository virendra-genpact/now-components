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
 *   5. (enrichments) resolve reference display fields, load declarative
 *      UI Policies (`sys_ui_policy` + `sys_ui_policy_action`) and form-button
 *      UI Actions (`sys_ui_action`),
 *   6. PATCH changes back on Save (or automatically on blur if Autosave).
 *
 * HTTP is done with `@servicenow/ui-effect-http` (`createHttpEffect`) so the
 * instance session / auth / scope are used automatically — we never hand-roll
 * `fetch()`. Each call chains to the next via dispatched actions.
 *
 * Reference fields are EDITABLE: rendered as a `now-typeahead` that searches the
 * referenced table over the Table API as the user types (debounced), and saves
 * the chosen record's sys_id.
 *
 * Mandatory / read-only come from `sys_dictionary` and are then overridden
 * dynamically by declarative UI Policy actions (mandatory / visible / disabled)
 * whose condition currently matches the record's values. UI Policies that "run
 * scripts" can't be executed over REST and are ignored (declarative actions only).
 *
 * UI Actions (form buttons) are rendered as `now-button`s; clicking one dispatches
 * `UI_ACTION_CLICKED` so the UIB page can react/navigate — the action's own
 * server/client script is NOT executed (out of scope for plain REST).
 *
 * Config (see now-ui.json):
 *   - `table`     (string)  table name, e.g. "incident"
 *   - `sysId`     (string)  record sys_id to load / save
 *   - `view`      (string)  form view name ("" = default view)
 *   - `readOnly`  (boolean) render every field disabled
 *   - `autosave`  (boolean) PATCH the record on field blur / change
 *   - `applyUiPolicy` (boolean) evaluate declarative UI Policies
 *   - `showUiActions` (boolean) render form-button UI Actions
 *   - `columns`   (number)  fields per row in each section
 *   - `saveLabel` / `showSave` — manual Save button
 *
 * Lessons applied: `initialState` + `updateState` (no `state` config key);
 * no now-* imports; CSS chevron (no JSX <svg>); defensive parsing throughout;
 * dispatch from the view (2nd arg) so each button has its own click handler
 * (NOW_BUTTON#CLICKED carries no name/id to disambiguate).
 * ------------------------------------------------------------------ */

/* ---- action types ---- */
const A = {
	FETCH_VIEW_NAME: 'DF#FETCH_VIEW_NAME',
	VIEW_NAME_OK: 'DF#VIEW_NAME_OK',
	VIEW_NAME_ERR: 'DF#VIEW_NAME_ERR',
	FETCH_RECORD: 'DF#FETCH_RECORD',
	RECORD_OK: 'DF#RECORD_OK',
	RECORD_ERR: 'DF#RECORD_ERR',
	FETCH_HIERARCHY: 'DF#FETCH_HIERARCHY',
	HIERARCHY_OK: 'DF#HIERARCHY_OK',
	HIERARCHY_ERR: 'DF#HIERARCHY_ERR',
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
	/* enrichments (run after the form is usable) */
	FETCH_REF_FIELDS: 'DF#FETCH_REF_FIELDS',
	REF_FIELDS_OK: 'DF#REF_FIELDS_OK',
	REF_FIELDS_ERR: 'DF#REF_FIELDS_ERR',
	FETCH_REF_OPTIONS: 'DF#FETCH_REF_OPTIONS',
	REF_OPTIONS_OK: 'DF#REF_OPTIONS_OK',
	REF_OPTIONS_ERR: 'DF#REF_OPTIONS_ERR',
	FETCH_UI_POLICY: 'DF#FETCH_UI_POLICY',
	UI_POLICY_OK: 'DF#UI_POLICY_OK',
	UI_POLICY_ERR: 'DF#UI_POLICY_ERR',
	FETCH_UI_POLICY_ACTIONS: 'DF#FETCH_UI_POLICY_ACTIONS',
	UI_POLICY_ACTIONS_OK: 'DF#UI_POLICY_ACTIONS_OK',
	UI_POLICY_ACTIONS_ERR: 'DF#UI_POLICY_ACTIONS_ERR',
	FETCH_UI_ACTIONS: 'DF#FETCH_UI_ACTIONS',
	UI_ACTIONS_OK: 'DF#UI_ACTIONS_OK',
	UI_ACTIONS_ERR: 'DF#UI_ACTIONS_ERR',
	SAVE: 'DF#SAVE',
	FETCH_RELATED_TARGETS: 'DF#FETCH_RELATED_TARGETS',
	RELATED_TARGETS_OK: 'DF#RELATED_TARGETS_OK',
	RELATED_TARGETS_ERR: 'DF#RELATED_TARGETS_ERR',
	SAVE_HTTP: 'DF#SAVE_HTTP',
	SAVE_HTTP_OK: 'DF#SAVE_HTTP_OK',
	SAVE_HTTP_ERR: 'DF#SAVE_HTTP_ERR',
};

/* Per-field debounce timers for reference typeahead server search (module-level
 * so they survive re-renders; one in-flight search slot is tracked in state). */
const refSearchTimers = {};

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

const isEmptyVal = (v) => v == null || String(v) === '';

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

// String fields longer than this render as a multi-line textarea (platform-like).
const LONG_STRING_LEN = 255;

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
			maxLength: Number(rawVal(r.max_length)) || 0,
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
 * Encoded-query (UI Policy condition) evaluator.
 *
 * Supports the standard operators and AND/OR/NQ grouping used by
 * sys_ui_policy.conditions, evaluated against the form's current raw values.
 * Grouping rule (matches ServiceNow): clauses are AND-ed; consecutive `^OR`
 * terms form an OR within the preceding clause; `^NQ` starts a new OR-ed query.
 * An empty condition matches (the policy always applies).
 * ------------------------------------------------------------------ */
const evalTerm = (term, values) => {
	if (!term) return true;
	if (/^(ORDERBY|GROUPBY|RLQUERY|EQ)/.test(term)) return true; // sorting / markers — ignore
	// field is [a-z0-9_.]+ ; operators are upper-case tokens (or symbols), so they
	// won't collide with lower-case field names. Multi-char ops listed first.
	const m = term.match(
		/^([a-zA-Z0-9_.]+?)(ISNOTEMPTY|ISEMPTY|ANYTHING|STARTSWITH|ENDSWITH|NOT LIKE|LIKE|NOT IN|IN|>=|<=|!=|>|<|=)(.*)$/
	);
	if (!m) return false;
	const field = m[1];
	const op = m[2];
	const arg = m[3];
	const raw = values ? values[field] : undefined;
	const v = raw == null ? '' : String(raw);
	const lv = v.toLowerCase();
	const la = String(arg).toLowerCase();
	const nv = Number(v);
	const na = Number(arg);
	const numeric = !isNaN(nv) && !isNaN(na);
	switch (op) {
		case 'ISEMPTY': return v === '';
		case 'ISNOTEMPTY': return v !== '';
		case 'ANYTHING': return true;
		case '=': return v === arg;
		case '!=': return v !== arg;
		case 'LIKE': return lv.indexOf(la) !== -1;
		case 'NOT LIKE': return lv.indexOf(la) === -1;
		case 'STARTSWITH': return lv.indexOf(la) === 0;
		case 'ENDSWITH': return lv.lastIndexOf(la) === lv.length - la.length && la.length <= lv.length;
		case 'IN': return arg.split(',').indexOf(v) !== -1;
		case 'NOT IN': return arg.split(',').indexOf(v) === -1;
		case '>': return numeric ? nv > na : v > arg;
		case '<': return numeric ? nv < na : v < arg;
		case '>=': return numeric ? nv >= na : v >= arg;
		case '<=': return numeric ? nv <= na : v <= arg;
		default: return false;
	}
};

const evalAndOr = (segment, values) => {
	const terms = String(segment).replace(/^\^+/, '').split('^').filter((t) => t !== '');
	if (!terms.length) return true;
	const clauses = [];
	terms.forEach((t) => {
		if (t.indexOf('OR') === 0 && clauses.length) {
			clauses[clauses.length - 1].push(t.slice(2));
		} else if (t.indexOf('OR') === 0) {
			clauses.push([t.slice(2)]);
		} else {
			clauses.push([t]);
		}
	});
	return clauses.every((cl) => cl.some((term) => evalTerm(term, values)));
};

const evalConditions = (conditions, values) => {
	const q = String(conditions || '').trim();
	if (!q) return true;
	return q.split('^NQ').some((seg) => evalAndOr(seg, values));
};

// tri-state from a sys_ui_policy_action value: 'true'|'false'|anything-else(ignore).
const triState = (v) => {
	const s = String(v);
	if (s === 'true') return true;
	if (s === 'false') return false;
	return null;
};

/* Evaluate every loaded UI Policy against current values and fold the matching
 * actions into a per-field override map { field -> { mandatory?, visible?, readonly? } }.
 * Later policies (higher order) override earlier ones. */
const computePolicyState = (policies, values) => {
	const out = {};
	(Array.isArray(policies) ? policies : []).forEach((p) => {
		const matched = evalConditions(p.conditions, values);
		(p.actions || []).forEach((a) => {
			if (!a.field) return;
			const m = triState(a.mandatory);
			const vis = triState(a.visible);
			const dis = triState(a.disabled);
			const tgt = (out[a.field] = out[a.field] || {});
			const set = (key, val, inverse) => {
				if (val === null) return;
				if (matched) tgt[key] = val;
				else if (p.reverseIfFalse) tgt[key] = inverse;
			};
			set('mandatory', m, m === null ? null : !m);
			set('visible', vis, vis === null ? null : !vis);
			set('readonly', dis, dis === null ? null : !dis);
		});
	});
	return out;
};

/* Effective per-field flags = dictionary defaults overridden by UI Policy. */
const effectiveFlags = (state, f) => {
	const ps = (state.properties && state.properties.applyUiPolicy)
		? (state._policyState || {})[f.name] || {}
		: {};
	return {
		visible: ps.visible !== undefined ? ps.visible : true,
		mandatory: ps.mandatory !== undefined ? ps.mandatory : !!f.mandatory,
		readonly: ps.readonly !== undefined ? ps.readonly : !!f.readonly,
	};
};

/* Visible + mandatory fields that are still empty → invalid (block save). */
const collectInvalid = (state) => {
	const inv = {};
	const secs = (state.model && Array.isArray(state.model.sections)) ? state.model.sections : [];
	secs.forEach((sec) => (sec.fields || []).forEach((f) => {
		const { visible, mandatory } = effectiveFlags(state, f);
		if (visible && mandatory && isEmptyVal(state.values && state.values[f.name])) inv[f.name] = true;
	}));
	return inv;
};

/* ------------------------------------------------------------------ *
 * Build the render model from the fetched pieces.
 * Also seeds reference metadata (target table per ref field) and the initial
 * typeahead items (current value's display) for each reference field.
 * ------------------------------------------------------------------ */
const assemble = (state) => {
	const dicts = state._dicts || {}; // table -> { col -> { label, type, reference, ... } }
	const baseTable = state._baseTable || '';
	const choices = state._choices || {}; // "table.col" -> [{label,value}]
	const record = state._record || {}; // name -> { value, display_value }
	const layout = Array.isArray(state._layout) ? state._layout : [];
	const family = (state._tableFamily && state._tableFamily.length) ? state._tableFamily : [baseTable];

	const fieldNames = Object.keys(record);
	const inRecord = new Set(fieldNames);

	const refMeta = {}; // field -> { table, displayField }
	const refItems = {}; // field -> [{ id, label }]

	// Choices are keyed by the table where the field is DEFINED. For a direct/inherited
	// field, resolveField returns the base table, but inherited choices are stored under
	// an ancestor — so fall back through the table family for non-dot-walked fields.
	const choicesFor = (table, col, dotwalk) => {
		const direct = table ? choices[`${table}.${col}`] : null;
		if (direct && direct.length) return direct;
		if (dotwalk) return null;
		for (let i = 0; i < family.length; i++) {
			const c = choices[`${family[i]}.${col}`];
			if (c && c.length) return c;
		}
		return null;
	};

	const makeField = (name) => {
		const dotwalk = name.indexOf('.') >= 0;
		const { table, col, meta } = resolveField(dicts, baseTable, name);
		const choiceList = choicesFor(table, col, dotwalk);
		const hasChoices = Array.isArray(choiceList) && choiceList.length > 0;
		let type = (meta && meta.type) || 'string';
		if (hasChoices) type = 'choice';
		// Long string fields render as a multi-line textarea, matching the platform
		// form (e.g. an `address` String with max_length 400).
		else if (type === 'string' && meta && meta.maxLength > LONG_STRING_LEN) type = 'textarea';
		if (type === 'reference' && meta && meta.reference) {
			refMeta[name] = { table: meta.reference, displayField: 'name' };
			const id = rawVal(record[name]);
			const lbl = dispVal(record[name]);
			// Item ids encode the field ("field::sysId") so the selection action can be
			// mapped back even when the typeahead's payload omits the field `name`.
			refItems[name] = !isEmptyVal(id) ? [{ id: `${name}::${id}`, label: lbl || id }] : [];
		}
		return {
			name, // original (possibly dot-walked) key — used for values
			label: (meta && meta.label) || prettify(col),
			type,
			choices: hasChoices ? choiceList : [],
			mandatory: !!(meta && meta.mandatory),
			readonly: !!(meta && meta.readonly),
			dotwalk,
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

	return { model: { sections }, values, display, _refMeta: refMeta, _refItems: refItems };
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
	updateState({
		_loadedKey: key, loading: true, error: '', _layout: [], _viewName: '',
		_tableFamily: [], _uiPolicies: [], _policyState: {}, _uiActions: [], _invalid: {},
	});

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
 * editable value (+ display), recompute UI Policies, notify, and autosave if on. */
const applyFieldChange = ({ state, updateState, dispatch }, name, value, displayText) => {
	if (!name) return;
	const values = { ...(state.values || {}), [name]: value };
	const dirty = { ...(state.dirty || {}), [name]: value };
	const patch = { values, dirty };
	if (displayText !== undefined) patch.display = { ...(state.display || {}), [name]: displayText };
	// Clear this field's invalid flag once it has a value.
	if (state._invalid && state._invalid[name] && !isEmptyVal(value)) {
		patch._invalid = { ...state._invalid };
		delete patch._invalid[name];
	}
	// Re-evaluate declarative UI Policies against the new values.
	patch._policyState = computePolicyState(state._uiPolicies || [], values);
	updateState(patch);
	dispatch('FIELD_CHANGED', { name, value: String(value == null ? '' : value) });
	if (state.properties.autosave) dispatch(A.SAVE, { fields: { [name]: value } });
};

/* Group dirty DOT-WALKED fields by their related record (the path minus the last
 * segment), resolving each group's target table + column. e.g.
 * "broker.brokeraddress.address1" -> prefix "broker.brokeraddress", col "address1". */
const buildRelatedGroups = (dicts, baseTable, related) => {
	const groups = {}; // prefix -> { table, cols: { col: value } }
	Object.keys(related).forEach((name) => {
		const segs = name.split('.');
		const prefix = segs.slice(0, -1).join('.');
		const { table, col } = resolveField(dicts, baseTable, name);
		if (!table) return; // unresolved chain — skip (can't safely target a record)
		groups[prefix] = groups[prefix] || { table, cols: {} };
		groups[prefix].cols[col] = related[name];
	});
	return groups;
};

// Fire one PATCH per record group; finalizeSave tracks completion via _savePending.
const runSaves = (updateState, dispatch, groups) => {
	const valid = groups.filter((g) => g && g.sysId && g.data && Object.keys(g.data).length);
	if (!valid.length) {
		updateState({ saving: false });
		return;
	}
	updateState({ saving: true, error: '', _savePending: valid.length, _saveError: '' });
	valid.forEach((g) =>
		dispatch(A.SAVE_HTTP, { table: g.table, sysId: g.sysId, data: g.data, sysparm_display_value: 'all' })
	);
};

// Called on each PATCH success/error; when all are done, surface the result once.
const finalizeSave = ({ state, updateState, dispatch }, patch) => {
	const pending = (state._savePending || 1) - 1;
	const saveError = patch.error || state._saveError || '';
	const merged = {};
	if (patch.values) merged.values = patch.values;
	if (patch.display) merged.display = patch.display;
	if (pending > 0) {
		updateState({ _savePending: pending, _saveError: saveError, ...merged });
		return;
	}
	if (saveError) {
		updateState({ saving: false, _savePending: 0, _saveError: '', error: `Save failed: ${saveError}`, ...merged });
		dispatch('SAVE_ERROR', { message: saveError });
	} else {
		updateState({ saving: false, _savePending: 0, dirty: {}, ...merged });
		dispatch('FORM_SAVED', { table: state.properties.table, sysId: state.properties.sysId });
	}
};

/* After the form is assembled, kick off the (independent) enrichment fetches:
 * reference display fields, UI policies, UI actions. Each updates state + re-renders. */
const startEnrichments = (state, dispatch) => {
	const { table, applyUiPolicy, showUiActions } = state.properties;

	// Reference display fields — which column to search/show per referenced table.
	const refTables = Array.from(new Set(
		Object.keys(state._refMeta || {}).map((f) => state._refMeta[f].table).filter(Boolean)
	));
	if (refTables.length) {
		dispatch(A.FETCH_REF_FIELDS, {
			sysparm_query: `nameIN${refTables.join(',')}^display=true`,
			sysparm_fields: 'name,element',
			sysparm_limit: '200',
		});
	}

	if (applyUiPolicy) {
		dispatch(A.FETCH_UI_POLICY, {
			sysparm_query: `table=${table}^active=true^ORDERBYorder`,
			sysparm_fields: 'sys_id,conditions,reverse_if_false,on_load,global,view,order',
			sysparm_display_value: 'all',
			sysparm_limit: '200',
		});
	}

	if (showUiActions) {
		dispatch(A.FETCH_UI_ACTIONS, {
			sysparm_query: `table=${table}^active=true^form_button=true^ORDERBYorder`,
			sysparm_fields: 'sys_id,name,action_name,hint',
			sysparm_display_value: 'false',
			sysparm_limit: '100',
		});
	}
};

/* ------------------------------------------------------------------ *
 * View
 * ------------------------------------------------------------------ */
const view = (state, { updateState, dispatch }) => {
	const {
		readOnly, columns, saveLabel, showSave, autosave, table, sysId,
		heading, subheading, saveButtonPosition, showUiActions,
	} = state.properties;
	const { loading, error, saving, model, values, display } = state;
	const secs = (model && Array.isArray(model.sections)) ? model.sections : [];
	const cols = Number(columns) > 0 ? Number(columns) : 2;
	const gridStyle = { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` };
	const invalidMap = state._invalid || {};
	const uiActions = Array.isArray(state._uiActions) ? state._uiActions : [];

	const valStr = (nm) => String(values && values[nm] != null ? values[nm] : '');
	const invalidMsgs = (nm) =>
		invalidMap[nm]
			? [{ status: 'critical', icon: 'circle-close-outline', content: 'Please complete this required field.' }]
			: undefined;

	// Each field is a real Horizon now-* control composed inside our card layout.
	// Change tracking: now-input/now-textarea/now-checkbox/now-typeahead carry `name`
	// in their dispatched action; now-select does not, so we encode the field into
	// each item id ("field::value") and decode it in the NOW_SELECT handler.
	const renderField = (f) => {
		const nm = f.name;
		const { visible, mandatory, readonly } = effectiveFlags(state, f);
		if (!visible) return null;
		const disabled = !!readOnly || readonly || saving;
		const invalid = !!invalidMap[nm];

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
						required={mandatory}
						disabled={disabled}
						invalid={invalid}
						messages={invalidMsgs(nm)}
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
						required={mandatory}
					/>
				</div>
			);
		}

		if (f.type === 'reference') {
			// Editable reference: now-typeahead searches the referenced table over the
			// Table API as the user types (debounced, see NOW_TYPEAHEAD#VALUE_SET) and
			// saves the chosen record's sys_id (NOW_TYPEAHEAD#SELECTED_ITEM_SET).
			const items = (state._refItems && state._refItems[nm]) || [];
			const cur = valStr(nm);
			// `value` drives the visible input text (selectedItem only marks the row);
			// seeded from the record's display value, kept in sync on type/select.
			const text = (display && display[nm] != null) ? String(display[nm]) : '';
			return (
				<div className="ff-field">
					<now-typeahead
						name={nm}
						label={f.label}
						items={items}
						value={text}
						selectedItem={cur ? `${nm}::${cur}` : null}
						disabled={disabled}
						required={mandatory}
						invalid={invalid}
						messages={invalidMsgs(nm)}
						search="managed"
						placeholder="Type to search…"
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
						required={mandatory}
						invalid={invalid}
						messages={invalidMsgs(nm)}
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
						required={mandatory}
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
					required={mandatory}
					invalid={invalid}
					messages={invalidMsgs(nm)}
				/>
			</div>
		);
	};

	// Save: validate visible+mandatory fields first, then PATCH the dirty set.
	const onSave = () => {
		const inv = collectInvalid(state);
		if (Object.keys(inv).length) {
			updateState({ _invalid: inv, error: 'Please complete the required fields.' });
			return;
		}
		updateState({ _invalid: {}, error: '' });
		dispatch(A.SAVE, { fields: { ...(state.dirty || {}) } });
	};

	const saveBtn = () => (
		<div className="ff-actions">
			{autosave ? <span className="ff-autosave">Autosave on</span> : null}
			<now-button
				label={saving ? 'Saving…' : (saveLabel || 'Save')}
				variant="primary"
				disabled={saving}
				on-click={onSave}
			/>
		</div>
	);

	// UI Action form buttons — clicking dispatches UI_ACTION_CLICKED (we do NOT run
	// the action's server/client script; the page handles it).
	const actionBar = () => (
		<div className="ff-uiactions">
			{uiActions.map((a) => (
				<now-button
					label={a.label}
					variant="secondary"
					tooltipContent={a.hint || undefined}
					disabled={saving}
					on-click={() => dispatch('UI_ACTION_CLICKED', {
						name: a.name || '',
						sysId: a.sysId || '',
						label: a.label || '',
					})}
				/>
			))}
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
	const hasActionBar = showUiActions && uiActions.length;

	return (
		<div className="ff-root">
			{(header || showTop) ? (
				<div className="ff-topbar">
					{header || <span></span>}
					{showTop ? saveBtn() : null}
				</div>
			) : null}

			{hasActionBar ? actionBar() : null}

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
		_savePending: 0,
		_saveError: '',
		_saveBaseGroup: null,
		_saveRelGroups: {},
		_viewName: '',
		_loadedKey: '',
		_dicts: {},
		_baseTable: '',
		_tableFamily: [],
		_dwTried: [],
		_choices: {},
		_record: {},
		_layout: [],
		_refMeta: {},
		_refItems: {},
		_refSearch: null,
		_uiPolicies: [],
		_policyState: {},
		_uiActions: [],
		_invalid: {},
	},
	properties: {
		table: { default: '' },
		sysId: { default: '' },
		view: { default: '' },
		heading: { default: '' },
		subheading: { default: '' },
		readOnly: { default: false },
		autosave: { default: false },
		saveRelated: { default: false },
		applyUiPolicy: { default: true },
		showUiActions: { default: true },
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

		/* reference typeahead: pick -> save sys_id (+ display label). The selected
		 * item id is encoded "field::sysId" so we can map it back even if the payload
		 * omits the field `name` (which is what broke reference saving). */
		'NOW_TYPEAHEAD#SELECTED_ITEM_SET': (cx) => {
			const p = cx.action.payload || {};
			const item = p.item || {};
			const raw = String(p.value == null ? '' : p.value);
			const i = raw.indexOf('::');
			const field = i >= 0 ? raw.slice(0, i) : p.name;
			const sysId = i >= 0 ? raw.slice(i + 2) : raw;
			applyFieldChange(cx, field, sysId, item.label);
		},
		/* reference typeahead: typing -> debounced server search of the ref table */
		'NOW_TYPEAHEAD#VALUE_SET': (cx) => {
			const { action, state, updateState, dispatch } = cx;
			const name = action.payload && action.payload.name;
			const term = String((action.payload && action.payload.value) || '');
			const rm = (state._refMeta || {})[name];
			if (!name || !rm) return;
			// reflect the typed text immediately so the controlled `value` doesn't reset it
			updateState({ display: { ...(state.display || {}), [name]: term } });
			if (refSearchTimers[name]) clearTimeout(refSearchTimers[name]);
			refSearchTimers[name] = setTimeout(() => {
				const df = rm.displayField || 'name';
				const q = term ? `${df}LIKE${term}^ORDERBY${df}` : `ORDERBY${df}`;
				updateState({ _refSearch: { field: name, displayField: df } });
				dispatch(A.FETCH_REF_OPTIONS, {
					table: rm.table,
					sysparm_query: q,
					sysparm_fields: `sys_id,${df}`,
					sysparm_display_value: 'all',
					sysparm_limit: '25',
				});
			}, 300);
		},

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
			// Resolve the table's parent hierarchy first so the dictionary fetch covers
			// INHERITED fields (e.g. comments / work_notes / state from `task`). The
			// dot-walked super_class.* fields walk up to ~4 ancestors in one call.
			dispatch(A.FETCH_HIERARCHY, {
				sysparm_query: `name=${state.properties.table}`,
				sysparm_fields: 'name,super_class.name,super_class.super_class.name,super_class.super_class.super_class.name,super_class.super_class.super_class.super_class.name',
				sysparm_display_value: 'false',
				sysparm_limit: '1',
			});
		},
		[A.RECORD_ERR]: ({ action, updateState }) =>
			updateState({ loading: false, error: `Could not load record: ${errOf(action)}` }),

		/* 1b) resolve the table hierarchy (base + ancestors) so inherited fields are
		 * included in the dictionary + choices fetches. */
		[A.FETCH_HIERARCHY]: createHttpEffect('/api/now/table/sys_db_object', {
			method: 'GET',
			queryParams: ['sysparm_query', 'sysparm_fields', 'sysparm_display_value', 'sysparm_limit'],
			successActionType: A.HIERARCHY_OK,
			errorActionType: A.HIERARCHY_ERR,
		}),
		[A.HIERARCHY_OK]: ({ action, state, updateState, dispatch }) => {
			const res = resultOf(action);
			const row = Array.isArray(res) ? res[0] : res;
			const base = state.properties.table;
			const family = [base];
			if (row) {
				['super_class.name', 'super_class.super_class.name',
					'super_class.super_class.super_class.name',
					'super_class.super_class.super_class.super_class.name'].forEach((k) => {
					const v = rawVal(row[k]);
					if (v && family.indexOf(v) < 0) family.push(v);
				});
			}
			updateState({ _tableFamily: family });
			dispatch(A.FETCH_DICT, {
				sysparm_query: `nameIN${family.join(',')}^elementISNOTEMPTY`,
				sysparm_fields: 'name,element,column_label,internal_type,reference,mandatory,read_only,max_length',
				sysparm_display_value: 'all',
				sysparm_limit: '8000',
			});
		},
		[A.HIERARCHY_ERR]: ({ state, updateState, dispatch }) => {
			// Couldn't resolve ancestors — fall back to the base table only.
			const base = state.properties.table;
			updateState({ _tableFamily: [base] });
			dispatch(A.FETCH_DICT, {
				sysparm_query: `name=${base}^elementISNOTEMPTY`,
				sysparm_fields: 'name,element,column_label,internal_type,reference,mandatory,read_only,max_length',
				sysparm_display_value: 'all',
				sysparm_limit: '5000',
			});
		},

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
					sysparm_fields: 'name,element,column_label,internal_type,reference,mandatory,read_only,max_length',
					sysparm_display_value: 'all',
					sysparm_limit: '8000',
				});
			} else {
				// Choices live under the table where the field is DEFINED, so include the
				// whole family (ancestors) + any dot-walked related tables.
				const choiceTables = Array.from(new Set([
					...(state._tableFamily || []),
					...Object.keys(dicts),
				]));
				dispatch(A.FETCH_CHOICES, {
					sysparm_query: `nameIN${choiceTables.join(',')}^inactive=false^ORDERBYelement^ORDERBYsequence`,
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
		[A.LAYOUT_OK]: ({ action, state, updateState, dispatch }) => {
			const rows = resultOf(action) || [];
			const next = { ...state, _layout: rows };
			const built = assemble(next);
			updateState({ _layout: rows, loading: false, ...built });
			startEnrichments({ ...state, ...built }, dispatch);
		},
		[A.LAYOUT_ERR]: ({ state, updateState, dispatch }) => {
			// Non-critical — assemble with no layout (single-section fallback).
			const next = { ...state, _layout: [] };
			const built = assemble(next);
			updateState({ _layout: [], loading: false, ...built });
			startEnrichments({ ...state, ...built }, dispatch);
		},

		/* ---- enrichment: reference display fields ---- */
		[A.FETCH_REF_FIELDS]: createHttpEffect('/api/now/table/sys_dictionary', {
			method: 'GET',
			queryParams: ['sysparm_query', 'sysparm_fields', 'sysparm_limit'],
			successActionType: A.REF_FIELDS_OK,
			errorActionType: A.REF_FIELDS_ERR,
		}),
		[A.REF_FIELDS_OK]: ({ action, state, updateState }) => {
			const rows = resultOf(action) || [];
			const byTable = {};
			rows.forEach((r) => { byTable[rawVal(r.name)] = rawVal(r.element); });
			const refMeta = { ...(state._refMeta || {}) };
			Object.keys(refMeta).forEach((f) => {
				const df = byTable[refMeta[f].table];
				if (df) refMeta[f] = { ...refMeta[f], displayField: df };
			});
			updateState({ _refMeta: refMeta });
		},
		[A.REF_FIELDS_ERR]: () => { /* keep the 'name' display-field default */ },

		/* ---- enrichment: reference typeahead search results ---- */
		[A.FETCH_REF_OPTIONS]: createHttpEffect('/api/now/table/:table', {
			method: 'GET',
			pathParams: ['table'],
			queryParams: ['sysparm_query', 'sysparm_fields', 'sysparm_display_value', 'sysparm_limit'],
			successActionType: A.REF_OPTIONS_OK,
			errorActionType: A.REF_OPTIONS_ERR,
		}),
		[A.REF_OPTIONS_OK]: ({ action, state, updateState }) => {
			const rows = resultOf(action) || [];
			const search = state._refSearch || {};
			if (!search.field) return;
			const df = search.displayField || 'name';
			const items = (Array.isArray(rows) ? rows : [])
				.map((r) => ({ sid: rawVal(r.sys_id), label: dispVal(r[df]) || rawVal(r[df]) }))
				.filter((r) => r.sid)
				.map((r) => ({
					id: `${search.field}::${r.sid}`, // encode field so selection maps back without `name`
					label: r.label || r.sid,
				}));
			updateState({ _refItems: { ...(state._refItems || {}), [search.field]: items } });
		},
		[A.REF_OPTIONS_ERR]: () => { /* search failed — keep prior items */ },

		/* ---- enrichment: UI policies (declarative) ---- */
		[A.FETCH_UI_POLICY]: createHttpEffect('/api/now/table/sys_ui_policy', {
			method: 'GET',
			queryParams: ['sysparm_query', 'sysparm_fields', 'sysparm_display_value', 'sysparm_limit'],
			successActionType: A.UI_POLICY_OK,
			errorActionType: A.UI_POLICY_ERR,
		}),
		[A.UI_POLICY_OK]: ({ action, state, updateState, dispatch }) => {
			const rows = resultOf(action) || [];
			const viewName = state._viewName || '';
			const policies = rows
				.filter((r) => {
					const global = rawVal(r.global) === 'true' || rawVal(r.global) === true;
					const pView = dispVal(r.view) || '';
					return global || !pView || pView === viewName;
				})
				.map((r) => ({
					id: rawVal(r.sys_id),
					conditions: rawVal(r.conditions) || '',
					reverseIfFalse: rawVal(r.reverse_if_false) === 'true' || rawVal(r.reverse_if_false) === true,
					actions: [],
				}));
			updateState({ _uiPolicies: policies });
			if (!policies.length) return;
			dispatch(A.FETCH_UI_POLICY_ACTIONS, {
				sysparm_query: `ui_policyIN${policies.map((p) => p.id).join(',')}`,
				sysparm_fields: 'ui_policy,field,mandatory,visible,disabled',
				sysparm_display_value: 'false',
				sysparm_limit: '1000',
			});
		},
		[A.UI_POLICY_ERR]: ({ updateState }) => updateState({ _uiPolicies: [], _policyState: {} }),

		[A.FETCH_UI_POLICY_ACTIONS]: createHttpEffect('/api/now/table/sys_ui_policy_action', {
			method: 'GET',
			queryParams: ['sysparm_query', 'sysparm_fields', 'sysparm_display_value', 'sysparm_limit'],
			successActionType: A.UI_POLICY_ACTIONS_OK,
			errorActionType: A.UI_POLICY_ACTIONS_ERR,
		}),
		[A.UI_POLICY_ACTIONS_OK]: ({ action, state, updateState }) => {
			const rows = resultOf(action) || [];
			const byPolicy = {};
			rows.forEach((r) => {
				const pid = rawVal(r.ui_policy);
				(byPolicy[pid] = byPolicy[pid] || []).push({
					field: rawVal(r.field),
					mandatory: rawVal(r.mandatory),
					visible: rawVal(r.visible),
					disabled: rawVal(r.disabled),
				});
			});
			const policies = (state._uiPolicies || []).map((p) => ({ ...p, actions: byPolicy[p.id] || [] }));
			updateState({ _uiPolicies: policies, _policyState: computePolicyState(policies, state.values || {}) });
		},
		[A.UI_POLICY_ACTIONS_ERR]: () => { /* no actions — policies stay condition-only */ },

		/* ---- enrichment: UI actions (form buttons) ---- */
		[A.FETCH_UI_ACTIONS]: createHttpEffect('/api/now/table/sys_ui_action', {
			method: 'GET',
			queryParams: ['sysparm_query', 'sysparm_fields', 'sysparm_display_value', 'sysparm_limit'],
			successActionType: A.UI_ACTIONS_OK,
			errorActionType: A.UI_ACTIONS_ERR,
		}),
		[A.UI_ACTIONS_OK]: ({ action, updateState }) => {
			const rows = resultOf(action) || [];
			const uiActions = rows.map((r) => ({
				sysId: rawVal(r.sys_id),
				name: rawVal(r.action_name) || rawVal(r.name) || '',
				label: rawVal(r.name) || rawVal(r.action_name) || 'Action',
				hint: rawVal(r.hint) || '',
			})).filter((a) => a.sysId);
			updateState({ _uiActions: uiActions });
		},
		[A.UI_ACTIONS_ERR]: ({ updateState }) => updateState({ _uiActions: [] }),

		/* Save: PATCH the base record. Dot-walked fields belong to RELATED records,
		 * so when `saveRelated` is on we group them by related record, resolve each
		 * record's sys_id, and PATCH it too; when off, they're dropped. */
		[A.SAVE]: ({ action, state, updateState, dispatch }) => {
			const all = (action.payload && action.payload.fields) || {};
			const base = {};
			const related = {};
			Object.keys(all).forEach((k) => {
				(k.indexOf('.') < 0 ? base : related)[k] = all[k];
			});
			const { table, sysId, saveRelated } = state.properties;
			const baseGroup = Object.keys(base).length ? { table, sysId, data: base } : null;
			const relGroups = saveRelated ? buildRelatedGroups(state._dicts || {}, state._baseTable, related) : {};
			const prefixes = Object.keys(relGroups);

			if (prefixes.length) {
				// Resolve each related record's sys_id from the base record first.
				updateState({ saving: true, error: '', _saveBaseGroup: baseGroup, _saveRelGroups: relGroups });
				dispatch(A.FETCH_RELATED_TARGETS, {
					table,
					sysId,
					sysparm_fields: prefixes.join(','),
					sysparm_display_value: 'false',
				});
				return;
			}
			runSaves(updateState, dispatch, baseGroup ? [baseGroup] : []);
		},

		/* Resolve the sys_id of each related record (value of the dot-walk prefix). */
		[A.FETCH_RELATED_TARGETS]: createHttpEffect('/api/now/table/:table/:sysId', {
			method: 'GET',
			pathParams: ['table', 'sysId'],
			queryParams: ['sysparm_fields', 'sysparm_display_value'],
			successActionType: A.RELATED_TARGETS_OK,
			errorActionType: A.RELATED_TARGETS_ERR,
		}),
		[A.RELATED_TARGETS_OK]: ({ action, state, updateState, dispatch }) => {
			const rec = resultOf(action) || {};
			const relGroups = state._saveRelGroups || {};
			const groups = state._saveBaseGroup ? [state._saveBaseGroup] : [];
			Object.keys(relGroups).forEach((prefix) => {
				const targetSysId = rawVal(rec[prefix]);
				if (targetSysId) groups.push({ table: relGroups[prefix].table, sysId: targetSysId, data: relGroups[prefix].cols });
			});
			runSaves(updateState, dispatch, groups);
		},
		[A.RELATED_TARGETS_ERR]: ({ state, updateState, dispatch }) =>
			runSaves(updateState, dispatch, state._saveBaseGroup ? [state._saveBaseGroup] : []),

		/* One PATCH per record (base or related); finalizeSave aggregates results. */
		[A.SAVE_HTTP]: createHttpEffect('/api/now/table/:table/:sysId', {
			method: 'PATCH',
			pathParams: ['table', 'sysId'],
			dataParam: 'data',
			queryParams: ['sysparm_display_value'],
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			successActionType: A.SAVE_HTTP_OK,
			errorActionType: A.SAVE_HTTP_ERR,
		}),
		[A.SAVE_HTTP_OK]: ({ action, state, updateState, dispatch }) => {
			const rec = resultOf(action) || {};
			const values = { ...(state.values || {}) };
			const display = { ...(state.display || {}) };
			// Only update keys we already track (base cols match; related plain cols won't).
			Object.keys(rec).forEach((n) => {
				if (Object.prototype.hasOwnProperty.call(values, n)) {
					values[n] = rawVal(rec[n]);
					display[n] = dispVal(rec[n]);
				}
			});
			finalizeSave({ state, updateState, dispatch }, { values, display });
		},
		[A.SAVE_HTTP_ERR]: ({ action, state, updateState, dispatch }) =>
			finalizeSave({ state, updateState, dispatch }, { error: errOf(action) }),
	},
});
