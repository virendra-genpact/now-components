import { createCustomElement, actionTypes } from '@servicenow/ui-core';
import snabbdom from '@servicenow/ui-renderer-snabbdom';
import { createHttpEffect } from '@servicenow/ui-effect-http';
import styles from './styles.scss';

/* ------------------------------------------------------------------ *
 * x-gegis-library-data-table
 *
 * A configurable record LIST / data grid for Next Experience (UI Builder).
 * Give it a TABLE and a fixed QUERY; it loads matching records over the
 * ServiceNow Table API (via `@servicenow/ui-effect-http`, batch:false — never a
 * hand-rolled fetch) and renders a paginated, OOTB-style grid with a rich set of
 * list features:
 *
 *   - global text search (top-right) + per-column query builder (is / in / not in
 *     / starts with / ends with / contains / …) folded into one server query
 *   - list / declarative UI actions (sys_ui_action, list context) as a toolbar
 *   - a configurable dropdown menu (emits an event), and JSON-defined custom
 *     per-row buttons (emit an event)
 *   - per-row Edit / Duplicate / Delete actions; action column left / right / sticky
 *   - a right slide-in DRAWER exposing a droppable <slot name="form"> so an author
 *     can drop x-gegis-library-dynamic-form (or any component). Edit opens it and
 *     emits EDIT_ACTION{sysId}; "Add new" opens it and emits ADD_NEW{sysId:"-1"}.
 *   - configurable row click: none / expand-collapse / open record (side | new tab)
 *   - clickable reference cells (open the referenced record side | new tab)
 *   - highlighted-value cells, HTML cells (rendered), zebra striping, conditional
 *     row highlighting (JSON rules), wrap-text per column
 *   - click-to-sort headers, group-by, column reorder (drag) + resize (drag)
 *   - inline editing (PATCH on commit), and a "show query" debug bar
 *
 * Composition (per SERVICENOW_CUSTOM_COMPONENT_DEV_RULES §0): we compose Horizon
 * now-* components wherever one exists — now-button / now-button-iconic / now-input
 * / now-select / now-dropdown / now-highlighted-value / now-loader /
 * now-pagination-control / now-icon — declared in now-ui.json `innerComponents`
 * and supplied by the instance at runtime (NOT imported into this deployed entry;
 * imported only in example/element.js for local preview — §3.1
 * [memory: do-not-bundle-now-star-use-horizon]).
 *
 * Documented custom exceptions (§5): the table grid, status pill, slide-in drawer
 * + overlay, column resize/reorder handles, expand detail row and group headers are
 * hand-rolled light-DOM markup (the design system has no now-table / drawer
 * primitive). All are themed with --now-* tokens (no hardcoded brand colors, no
 * shadow-DOM piercing).
 *
 * Events are declared in now-ui.json under `actions` so UI Builder can bind them
 * [memory: uib-events-actions-key-gotcha]. Internal-only UI state (expand, sort,
 * resize, reorder, search typing, drawer open/close) is NOT an event (§9).
 *
 * Lessons applied: no now-* import here; `initialState`+`updateState` (no `state`
 * key); HTML cells use props={{innerHTML}} (no JSX <svg>); now-select/now-dropdown
 * changes bubble to the host actionHandlers and are disambiguated by an encoded
 * item id (now-select carries no field name)
 * [memory: now-form-controls-change-disambiguation].
 * ------------------------------------------------------------------ */

/* ---- action types ---- */
const A = {
	FETCH: 'DT#FETCH',
	FETCH_OK: 'DT#FETCH_OK',
	FETCH_ERR: 'DT#FETCH_ERR',
	FETCH_LIST_ACTIONS: 'DT#FETCH_LIST_ACTIONS',
	LIST_ACTIONS_OK: 'DT#LIST_ACTIONS_OK',
	LIST_ACTIONS_ERR: 'DT#LIST_ACTIONS_ERR',
	FETCH_CHOICES: 'DT#FETCH_CHOICES',
	CHOICES_OK: 'DT#CHOICES_OK',
	CHOICES_ERR: 'DT#CHOICES_ERR',
	FETCH_DICT: 'DT#FETCH_DICT',
	DICT_OK: 'DT#DICT_OK',
	DICT_ERR: 'DT#DICT_ERR',
	IE_REF_SEARCH: 'DT#IE_REF_SEARCH',
	IE_REF_OK: 'DT#IE_REF_OK',
	IE_REF_ERR: 'DT#IE_REF_ERR',
	INLINE_SAVE: 'DT#INLINE_SAVE',
	INLINE_OK: 'DT#INLINE_OK',
	INLINE_ERR: 'DT#INLINE_ERR',
	DELETE: 'DT#DELETE_HTTP',
	DELETE_OK: 'DT#DELETE_OK',
	DELETE_ERR: 'DT#DELETE_ERR',
	SORT: 'DT#SORT',
	REORDER: 'DT#REORDER',
	RESIZE: 'DT#RESIZE',
	DRAWER_RESIZE: 'DT#DRAWER_RESIZE',
};

/* Module-level transient drag state (survives re-renders). Only the field being
 * dragged for reorder; resize tracks via the document listeners' closure. */
let dragField = null;
/* Debounce timers (module-level so they survive re-renders). */
let searchTimer = null;
let ieRefTimer = null;

// Map a sys_dictionary internal_type to a render / inline-edit control kind.
const normType = (disp) => {
	const t = String(disp || '').toLowerCase();
	if (t.includes('html') || t.includes('wiki')) return 'html';
	if (t.includes('true/false') || t.includes('boolean')) return 'boolean';
	if (t.includes('reference') || t.includes('document id')) return 'reference';
	if (t.includes('date/time') || /\btime\b/.test(t)) return 'datetime';
	if (/\bdate\b/.test(t)) return 'date';
	if (t.includes('integer') || t.includes('long') || t.includes('decimal') || t.includes('float') || t.includes('currency') || t.includes('price') || t.includes('percent') || t.includes('numeric')) return 'number';
	return 'string';
};

// Split text around the search term (case-insensitive) into vnodes, wrapping matches
// in <mark> so the global-search term is highlighted in the rendered cells.
const highlightMatches = (text, term) => {
	const s = String(text == null ? '' : text);
	const q = String(term || '').trim();
	if (!q) return s;
	const lc = s.toLowerCase();
	const lq = q.toLowerCase();
	if (lc.indexOf(lq) < 0) return s;
	const out = [];
	let i = 0;
	let idx = lc.indexOf(lq, i);
	while (idx >= 0) {
		if (idx > i) out.push(s.slice(i, idx));
		out.push(<mark className="dt-mark">{s.slice(idx, idx + lq.length)}</mark>);
		i = idx + lq.length;
		idx = lc.indexOf(lq, i);
	}
	if (i < s.length) out.push(s.slice(i));
	return out;
};

/* ---- helpers ---- */

// Unwrap the `result` payload from an http-effect success action, defensively.
const resultOf = (action) => {
	const p = (action && action.payload) || {};
	if (Array.isArray(p.result)) return p.result;
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

// sysparm_display_value=all returns { value, display_value, link? } per field.
const rawVal = (cell) => (cell && typeof cell === 'object' ? cell.value : cell);
const dispVal = (cell) => (cell && typeof cell === 'object' ? cell.display_value : cell);
const linkVal = (cell) => (cell && typeof cell === 'object' ? cell.link : undefined);

// Humanize a column name when no explicit label is given.
const prettify = (s) =>
	String(s || '')
		.replace(/_/g, ' ')
		.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
		.replace(/\b\w/g, (c) => c.toUpperCase());

const splitList = (s) =>
	String(s || '')
		.split(',')
		.map((x) => x.trim())
		.filter(Boolean);

// Parse a JSON-array property defensively (top-level array defaults aren't allowed
// in now-ui.json, so these props default to "" and are parsed here at runtime).
const parseJsonArray = (s) => {
	if (Array.isArray(s)) return s;
	const str = String(s || '').trim();
	if (!str) return [];
	try {
		const v = JSON.parse(str);
		return Array.isArray(v) ? v : [];
	} catch (e) {
		return [];
	}
};

/* Map a status display value to a semantic tone (drives the pill color).
 * Unknown values fall back to a neutral gray pill. */
const TONE_MAP = {
	published: 'positive', active: 'positive', approved: 'positive', complete: 'positive',
	completed: 'positive', open: 'positive', live: 'positive', enabled: 'positive',
	draft: 'info', new: 'info', pending: 'info', 'in progress': 'info', submitted: 'info',
	archived: 'neutral', inactive: 'neutral', retired: 'neutral', closed: 'neutral',
	cancelled: 'neutral', canceled: 'neutral', disabled: 'neutral',
	review: 'warning', 'in review': 'warning', 'on hold': 'warning', warning: 'warning', overdue: 'warning',
	rejected: 'error', failed: 'error', error: 'error', expired: 'error', critical: 'error',
};
const statusTone = (v) => TONE_MAP[String(v == null ? '' : v).trim().toLowerCase()] || 'neutral';
// Map a tone to a now-highlighted-value `color`.
const hvColor = (tone) =>
	({ positive: 'positive', info: 'info', warning: 'warning', error: 'critical', neutral: 'gray' }[tone] || 'gray');

// Relative "time ago" for the header's "Last refreshed …" subtitle (native-list manner).
const relTime = (ts) => {
	if (!ts) return '';
	const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
	if (s < 45) return 'just now';
	const m = Math.floor(s / 60);
	if (m < 1) return 'just now';
	if (m < 60) return `${m} minute${m > 1 ? 's' : ''} ago`;
	const h = Math.floor(m / 60);
	if (h < 24) return `${h} hour${h > 1 ? 's' : ''} ago`;
	const d = Math.floor(h / 24);
	return `${d} day${d > 1 ? 's' : ''} ago`;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// If a raw value looks like an ISO date (date or date/time), render "Mon D, YYYY".
const prettyDate = (raw, disp) => {
	const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(raw == null ? '' : raw));
	if (!m) return disp;
	return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`;
};

/* ---- query building -------------------------------------------------------- *
 * The effective sysparm_query is a single AND-join of: the fixed filter, a global
 * text search (123TEXTQUERY321 — the platform full-text operator, which ANDs
 * cleanly with everything), the per-column filters, then ORDERBY clauses (optional
 * group field first, then the active sort). */

// Per-column operator menu (id = encoded operator, label shown to the user).
const OPERATORS = [
	{ id: '=', label: 'is' },
	{ id: '!=', label: 'is not' },
	{ id: 'LIKE', label: 'contains' },
	{ id: 'STARTSWITH', label: 'starts with' },
	{ id: 'ENDSWITH', label: 'ends with' },
	{ id: 'IN', label: 'in' },
	{ id: 'NOT IN', label: 'not in' },
	{ id: '>', label: 'greater than' },
	{ id: '<', label: 'less than' },
	{ id: 'ISEMPTY', label: 'is empty' },
	{ id: 'ISNOTEMPTY', label: 'is not empty' },
];
const NO_VALUE_OPS = { ISEMPTY: 1, ISNOTEMPTY: 1 };

// Build one encoded clause for a column filter (or '' when it should be skipped).
const filterClause = (field, op, value) => {
	if (!field || !op) return '';
	if (NO_VALUE_OPS[op]) return `${field}${op}`;
	const v = String(value == null ? '' : value).trim();
	if (v === '') return '';
	return `${field}${op}${v}`; // "field=v", "field!=v", "fieldLIKEv", "fieldINa,b", …
};

// ORDERBY segment: optional group field first, then the active sort (state override
// or the configured orderBy/orderDescending; a leading "-" also means descending).
const orderClause = (props, state, group) => {
	const segs = [];
	if (group) segs.push(`ORDERBY${group}`);
	let sf = state && state.sortField ? state.sortField : props.orderBy;
	let desc = state && state.sortField ? state.sortDir === 'desc' : !!props.orderDescending;
	sf = String(sf || '').trim();
	if (sf.charAt(0) === '-') { desc = true; sf = sf.slice(1); }
	if (sf && sf !== group) segs.push(desc ? `ORDERBYDESC${sf}` : `ORDERBY${sf}`);
	return segs.join('^');
};

// The active group-by field: runtime override (state.groupBy) else the config prop.
const activeGroup = (props, state) =>
	(state && state.groupBy != null && state.groupBy !== '') ? state.groupBy : (props.groupByField || '');

/* Global search → a case-INSENSITIVE OR group across the configured columns, e.g.
 * "col1LIKEterm^ORcol2LIKEterm^OR…". LIKE is case-insensitive and matches the actual
 * stored value (NOT only the table's text index), so a valid term in ANY column returns
 * rows. Reference columns are dot-walked to their display field (assumed `name`, matching
 * the component's inline-edit reference search) so the visible text is searched, not the
 * sys_id. When the columns are auto-derived (no `fields` configured) we can't enumerate
 * them at query-build time, so we fall back to the platform text-index operator.
 *
 * Placed LAST in the query (after the fixed filter + column filters) so it forms a single
 * trailing OR group: "base^colALIKE^ORcolBLIKE" == "base AND (colA OR colB)" — the same
 * grouping the condition builder produces for "x AND (a OR b)". */
const searchGroup = (props, state) => {
	const term = String((state && state.search) || '').trim().replace(/\^/g, ' ');
	if (!term) return '';
	const cols = splitList(props.fields);
	if (!cols.length) return `123TEXTQUERY321=${term}`;
	const fm = (state && state.fieldMeta) || {};
	return cols.map((f) => {
		if (f.indexOf('.') >= 0) return `${f}LIKE${term}`;          // already dot-walked
		const meta = fm[f];
		if (meta && meta.type === 'reference') return `${f}.nameLIKE${term}`; // search ref display
		return `${f}LIKE${term}`;
	}).join('^OR');
};

// Assemble the full sysparm_query from props + runtime state.
const currentQuery = (props, state) => {
	const parts = [];
	if (props.query) parts.push(props.query);
	const cf = (state && state.colFilters) || {};
	Object.keys(cf).forEach((field) => {
		const clause = filterClause(field, cf[field] && cf[field].op, cf[field] && cf[field].value);
		if (clause) parts.push(clause);
	});
	// Search OR-group goes LAST so it stays a single trailing (a OR b OR c) group.
	const sg = searchGroup(props, state);
	if (sg) parts.push(sg);
	const base = parts.join('^');
	const order = orderClause(props, state, activeGroup(props, state));
	return base ? (order ? `${base}^${order}` : base) : order;
};

/* Resolve the columns to render: explicit `fields` (with optional `labels`),
 * else derive from the first record's keys (minus sys_id). */
const computeColumns = (props, rows) => {
	const fields = splitList(props.fields);
	const labels = splitList(props.labels);
	if (fields.length) return fields.map((f, i) => ({ field: f, label: labels[i] || prettify(f) }));
	const first = rows[0] || {};
	return Object.keys(first)
		.filter((k) => k !== 'sys_id')
		.map((f) => ({ field: f, label: prettify(f) }));
};

// Apply a user-defined column order (drag-to-reorder) to the computed columns.
// Unknown / new columns keep their original relative order at the end.
const applyColumnOrder = (cols, order) => {
	if (!order || !order.length) return cols;
	const idx = (f) => { const i = order.indexOf(f); return i < 0 ? order.length + 1 : i; };
	return cols
		.map((c, i) => ({ c, i }))
		.sort((a, b) => (idx(a.c.field) - idx(b.c.field)) || (a.i - b.i))
		.map((x) => x.c);
};

// Parse a Table-API reference link ".../api/now/table/<table>/<sys_id>" → {table,sysId}.
const parseRefLink = (link) => {
	const m = /\/table\/([^/?#]+)\/([0-9a-f]{32})/i.exec(String(link || ''));
	return m ? { table: m[1], sysId: m[2] } : null;
};

// Evaluate one conditional-highlight rule against a row's value.
const ruleMatches = (rule, row) => {
	if (!rule || !rule.field) return false;
	const cell = row[rule.field];
	const raw = rawVal(cell);
	const disp = dispVal(cell);
	const v = String(raw == null ? (disp == null ? '' : disp) : raw);
	const lv = v.toLowerCase();
	const a = String(rule.value == null ? '' : rule.value);
	const la = a.toLowerCase();
	switch (String(rule.op || '=').toLowerCase()) {
		case '=': case 'is': return lv === la;
		case '!=': case 'isnot': return lv !== la;
		case 'like': case 'contains': return lv.indexOf(la) >= 0;
		case 'startswith': return lv.indexOf(la) === 0;
		case 'endswith': return la.length <= lv.length && lv.lastIndexOf(la) === lv.length - la.length;
		case '>': return Number(raw) > Number(rule.value);
		case '<': return Number(raw) < Number(rule.value);
		case 'empty': case 'isempty': return v === '';
		case 'notempty': case 'isnotempty': return v !== '';
		default: return false;
	}
};
// First matching rule's color (or '' if none match).
const rowHighlightColor = (rules, row) => {
	for (let i = 0; i < rules.length; i++) {
		if (ruleMatches(rules[i], row)) return rules[i].color || 'var(--now-color--warning-0, #fdf0dc)';
	}
	return '';
};

// Read the Table API's X-Total-Count header (delivered in the success action meta).
const totalFromHeaders = (action) => {
	const meta = (action && action.meta) || {};
	const h = meta.responseHeaders;
	if (!h) return undefined;
	let v;
	if (typeof h.get === 'function') v = h.get('X-Total-Count');
	else v = h['X-Total-Count'] != null ? h['X-Total-Count'] : (h['x-total-count'] != null ? h['x-total-count'] : h['X-TOTAL-COUNT']);
	if (v == null || v === '') return undefined;
	const n = Number(v);
	return Number.isFinite(n) ? n : undefined;
};

// Effective page size: runtime override (state.size) wins, else `pageSize`, else 5.
const effSize = (state) => {
	const s = Number(state.size);
	if (s > 0) return s;
	const p = Number(state.properties.pageSize);
	return p > 0 ? p : 5;
};

// Parse the configured per-page options, guaranteeing the current size is present.
const parseSizes = (raw, current) => {
	let arr = splitList(raw).map(Number).filter((n) => Number.isFinite(n) && n > 0);
	if (!arr.length) arr = [5, 10, 20, 50, 100];
	if (current > 0 && arr.indexOf(current) < 0) arr.push(current);
	return arr.sort((a, b) => a - b);
};

/* ------------------------------------------------------------------ *
 * Lazy server-side paging — only the CURRENT page's rows are loaded
 * (sysparm_limit + sysparm_offset). The pager total comes from X-Total-Count.
 * ------------------------------------------------------------------ */
const fetchPage = (dispatch, props, state, page, size) => {
	const { table } = props;
	const lim = Number(size) > 0 ? Number(size) : 5;
	const payload = {
		table,
		sysparm_display_value: 'all',
		// Keep the reference link when reference cells must be clickable; otherwise
		// drop it for a lighter response.
		sysparm_exclude_reference_link: props.enableReferenceLinks ? 'false' : 'true',
		sysparm_limit: String(lim),
		sysparm_offset: String(Math.max(0, Number(page) || 0) * lim),
	};
	const q = currentQuery(props, state);
	if (q) payload.sysparm_query = q;
	// Always include sys_id; include the group field so client-side group headers work.
	const cols = splitList(props.fields);
	if (cols.length) {
		const extra = [];
		if (cols.indexOf('sys_id') < 0) extra.push('sys_id');
		const grp = activeGroup(props, state);
		if (grp && cols.indexOf(grp) < 0) extra.push(grp);
		payload.sysparm_fields = cols.concat(extra).join(',');
	}
	dispatch(A.FETCH, payload);
};

// Config-driven (re)load: refetch from page 0 when the table/query/columns identity
// changes; also (re)load the list UI actions.
const maybeLoad = ({ state, updateState, dispatch }) => {
	const p = state.properties;
	if (!p.table) {
		updateState({ rows: [], total: 0, loading: false, error: '', page: 0, size: 0, _loadedKey: '', listActions: [] });
		return;
	}
	const key = [p.table, p.query, p.orderBy, p.orderDescending, p.fields, p.pageSize, p.groupByField, p.enableReferenceLinks].join('|');
	if (key !== state._loadedKey) {
		const propSize = Number(p.pageSize) > 0 ? Number(p.pageSize) : 5;
		// A config change resets runtime size/sort/group/filter/search back to config.
		const next = { ...state, size: propSize, search: '', colFilters: {}, sortField: '', sortDir: '', groupBy: '' };
		updateState({
			_loadedKey: key, loading: true, error: '', page: 0, rows: [], total: 0,
			size: propSize, search: '', colFilters: {}, sortField: '', sortDir: '', groupBy: '',
		});
		fetchPage(dispatch, p, next, 0, propSize);
	}
	// List / declarative actions (sys_ui_action, list context) — load once per table.
	const listKey = p.showListActions ? p.table : '';
	if (listKey !== state._listKey) {
		updateState({ _listKey: listKey });
		if (listKey) {
			dispatch(A.FETCH_LIST_ACTIONS, {
				sysparm_query: `table=${p.table}^active=true^list_banner_button=true^ORDERBYorder`,
				sysparm_fields: 'sys_id,name,action_name,hint',
				sysparm_display_value: 'false',
				sysparm_limit: '50',
			});
		} else {
			updateState({ listActions: [] });
		}
	}

	// Choice lists for the table — used so choice columns get a multi-select
	// "Edit filter" picker (like the native list) instead of a plain value input.
	if (p.table !== state._choiceKey) {
		updateState({ _choiceKey: p.table });
		dispatch(A.FETCH_CHOICES, {
			sysparm_query: `name=${p.table}^inactive=false^ORDERBYelement^ORDERBYsequence`,
			sysparm_fields: 'element,label,value',
			sysparm_limit: '4000',
		});
	}

	// Field metadata (type / reference target) — drives HTML-column auto-detection and
	// the typed inline-edit controls (choice/reference/date/boolean/number/text).
	if (p.table !== state._dictKey) {
		updateState({ _dictKey: p.table });
		dispatch(A.FETCH_DICT, {
			sysparm_query: `name=${p.table}^elementISNOTEMPTY`,
			sysparm_fields: 'element,internal_type,reference',
			sysparm_display_value: 'all',
			sysparm_limit: '4000',
		});
	}
};

/* Stage a PENDING inline-edit value (no PATCH yet) — the typed control updates this
 * as the user edits; it is committed only when they click Apply. */
const stageIe = (cx, value, display) => {
	const ec = cx.state.editingCell;
	if (!ec) return;
	const patch = { ...ec, value: String(value == null ? '' : value) };
	if (display != null) patch.display = String(display);
	cx.updateState({ editingCell: patch });
};

/* Commit an inline-edit value: PATCH the record + emit INLINE_EDIT, close the editor. */
const commitInline = (cx, value) => {
	const ec = cx.state.editingCell;
	if (!ec || !ec.sysId || !ec.field) return;
	cx.dispatch(A.INLINE_SAVE, { table: cx.state.properties.table, sysId: ec.sysId, data: { [ec.field]: value }, sysparm_display_value: 'all' });
	cx.dispatch('INLINE_EDIT', { sysId: ec.sysId, field: ec.field, value: String(value == null ? '' : value) });
};

// Runtime (re)load after a search / filter / sort / group / page-size change:
// merge the patch, reset to page 0, refetch.
const reload = ({ state, updateState, dispatch }, patch) => {
	const next = { ...state, ...patch };
	updateState({ ...patch, page: 0, loading: true, error: '' });
	fetchPage(dispatch, state.properties, next, 0, effSize(next));
};

/* Dispatch a record-scoped event ({ sysId, table, … }). */
const emit = (dispatch, name, payload) => dispatch(name, payload);

// Open a record in a new browser tab via the classic form URL. The OPEN_RECORD /
// REFERENCE_CLICK events let the page override navigation (e.g. workspace routing).
const openInNewTab = (table, sysId) => {
	if (typeof window !== 'undefined' && window.open) window.open(`/${table}.do?sys_id=${sysId}`, '_blank');
};

/* ------------------------------------------------------------------ *
 * View
 * ------------------------------------------------------------------ */
const view = (state, { updateState, dispatch }) => {
	const props = state.properties;
	const {
		table, heading, itemLabel,
		showActions, showEdit, showCopy, showDelete, actionsLabel,
		editIcon, copyIcon, deleteIcon, emptyMessage,
		showPageSizeControl, pageSizes, pageSizeLabel,
		showGlobalSearch, globalSearchPlaceholder, showColumnFilters,
		showAddNew, addNewLabel, showDropdown, dropdownPlaceholder,
		enableDrawer, drawerTitle, drawerWidth,
		rowClickAction, openRecordIn, enableReferenceLinks, referenceOpenIn,
		highlightedValueFields, wrapAtChars,
		actionColumnPosition, showQuery, zebra,
		enableSort, enableGroupBy, enableReorder, enableResize, enableInlineEdit,
	} = props;
	const { loading, error, rows, page } = state;
	const list = Array.isArray(rows) ? rows : [];   // already just the current page

	/* ---- presentation variant ---- *
	 * "viewOnly" is a clean, read-style layout (like the native presentational list):
	 * an inline search pill, plain columns + per-row actions + footer pager — and NONE
	 * of the management chrome (toolbar Filter/Sort/Group chips, leading filter-icon
	 * column, per-column ⋮ menus, count badge / "last refreshed" subtitle, More-actions
	 * menu, column reorder/resize, inline cell editing). Per-row Edit/Duplicate/Delete
	 * still show. */
	// Tolerant match: accept "viewOnly" / "view only" / "View-Only" / "viewonly" etc.
	// (UI Builder choice bindings can deliver the value or the label in varying case).
	const viewOnly = String(props.variant || '').toLowerCase().replace(/[^a-z]/g, '') === 'viewonly';
	const effEnableSort = enableSort && !viewOnly;
	const effEnableGroupBy = enableGroupBy && !viewOnly;
	const effEnableReorder = enableReorder && !viewOnly;
	const effEnableResize = enableResize && !viewOnly;
	const effEnableInlineEdit = enableInlineEdit && !viewOnly;

	if (!table) {
		return (
			<div className="dt-root dt-root--msg">
				{heading ? <div className="dt-heading">{heading}</div> : null}
				<div className="dt-msg">Configure a <b>Table</b> to load records.</div>
			</div>
		);
	}

	/* ---- derived column model ---- */
	// When columns are auto-derived (no explicit `fields`) and the current page is
	// empty (e.g. a filter matched nothing), fall back to the last-known derived
	// columns so the headers / filter row / sort & group chips never disappear.
	let columns = computeColumns(props, list);
	if (!columns.length && Array.isArray(state.derivedColumns) && state.derivedColumns.length) {
		columns = state.derivedColumns.map((f) => ({ field: f, label: prettify(f) }));
	}
	columns = applyColumnOrder(columns, state.columnOrder);
	const hvSet = new Set(splitList(highlightedValueFields));
	const widths = state.columnWidths || {};
	const colFilters = state.colFilters || {};
	const choices = state.choices || {};
	const fieldMeta = state.fieldMeta || {};
	const searchTerm = String(state.search || '').trim();
	// Per-column character wrap: 0 = off (single-line, truncate); >0 = wrap, cap line
	// width at N characters.
	const wrapChars = Number(wrapAtChars) > 0 ? Number(wrapAtChars) : 0;
	const isHtmlField = (f) => { const m = fieldMeta[f]; return !!(m && m.type === 'html'); };
	const highlightRules = parseJsonArray(props.rowHighlightRules);
	const customButtons = parseJsonArray(props.customButtons);
	const listActions = Array.isArray(state.listActions) ? state.listActions : [];
	const dropdownItems = parseJsonArray(props.dropdownItems);
	const expanded = state.expandedRows || {};
	const editingCell = state.editingCell || null;

	const actionPos = actionColumnPosition || 'right';
	const anyRowActions = !!showActions && (showEdit || showCopy || showDelete || customButtons.length > 0);
	const actionsFirst = actionPos === 'left';
	const actionsSticky = actionPos === 'sticky';
	// Leading narrow column carrying the filter (funnel) toggle icon — like the native
	// list (icon to the left of where a selection checkbox would be; NO checkbox added).
	const leadCol = !viewOnly && props.showFilterIcon !== false;
	const colCount = columns.length + (anyRowActions ? 1 : 0) + (leadCol ? 1 : 0);
	const grp = effEnableGroupBy ? activeGroup(props, state) : '';

	/* ---- toolbar chips (filter / sort / group-by) — native-list manner ---- */
	// Column filters show/hide is CLIENT-SIDE: a runtime toggle (state.filtersVisible)
	// that defaults to the showColumnFilters config; toggling it never refetches.
	// (Always hidden in the View Only variant — no filter row.)
	const filtersVisible = viewOnly ? false : (state.filtersVisible != null ? state.filtersVisible : !!showColumnFilters);
	const activeFilterCount = Object.keys(colFilters).filter((f) => {
		const cf = colFilters[f];
		return cf && filterClause(f, cf.op, cf.value);
	}).length;
	const colLabelOf = (field) => { const c = columns.find((x) => x.field === field); return c ? c.label : prettify(field); };
	const sortField = state.sortField || props.orderBy;
	const sortDesc = state.sortField ? state.sortDir === 'desc' : !!props.orderDescending;
	const sortChipLabel = sortField ? `${colLabelOf(String(sortField).replace(/^-/, ''))} ${sortDesc ? '↓' : '↑'}` : 'Sort';
	const sortItems = columns.map((c) => ({ id: `sort::${c.field}`, label: c.label }));
	const groupChipLabel = grp ? colLabelOf(grp) : 'Group by';
	const groupItems = [{ id: 'grp2::', label: '— None —' }].concat(columns.map((c) => ({ id: `grp2::${c.field}`, label: c.label })));

	/* ---- toolbar: chips (left) | list actions + dropdown + search + add-new (right) ---- */
	const toolbar = (
		<div className="dt-toolbar">
			<div className="dt-toolbar-left">
				{!viewOnly && heading ? (
					<div className="dt-titlewrap">
						<div className="dt-titlerow">
							<span className="dt-heading">{heading}</span>
							{props.showCount !== false ? <span className="dt-count">{Number(state.total) || 0}</span> : null}
						</div>
						{props.showLastRefreshed !== false && state.lastRefreshed ? (
							<span className="dt-subtitle">Last refreshed {relTime(state.lastRefreshed)}</span>
						) : null}
					</div>
				) : null}
				{showGlobalSearch && viewOnly ? (
					/* View Only: an always-visible inline search pill (not the icon+popover). */
					<now-input
						className="dt-search-inline"
						name="gs"
						type="text"
						variant="standard"
						icon="magnifying-glass-outline"
						placeholder={globalSearchPlaceholder || 'Search'}
						value={state.search || ''}
					/>
				) : null}
				{showGlobalSearch && !viewOnly ? (
					<div className="dt-search-wrap">
						<now-button-iconic
							className={`dt-search-icon${state.searchOpen || state.search ? ' dt-search-icon--on' : ''}`}
							icon="magnifying-glass-outline"
							variant={state.searchOpen || state.search ? 'primary' : 'secondary'}
							size="sm"
							tooltipContent="Search"
							configAria={{ button: { 'aria-label': 'Search' } }}
							on-click={() => updateState({ searchOpen: !state.searchOpen })}
						/>
						{state.searchOpen ? (
							<div className="dt-search-pop">
								<div className="dt-search-pop-head">
									<span className="dt-search-pop-title">Search</span>
									<now-button-iconic icon="close-outline" variant="tertiary" size="sm" bare tooltipContent="Close" on-click={() => updateState({ searchOpen: false })} />
								</div>
								<now-input
									className="dt-search"
									name="gs"
									type="text"
									variant="standard"
									icon="magnifying-glass-outline"
									placeholder={globalSearchPlaceholder || 'Search'}
									value={state.search || ''}
								/>
								<div className="dt-search-pop-foot">
									<now-button label="Clear" variant="tertiary" size="sm" on-click={() => dispatch('DT#SEARCH_CLEAR')} />
								</div>
							</div>
						) : null}
					</div>
				) : null}
				{!viewOnly && props.showFilterToggle ? (
					<now-button
						className={`dt-chip${filtersVisible ? ' dt-chip--on' : ''}`}
						icon="filter-outline"
						label={activeFilterCount ? `${activeFilterCount} condition${activeFilterCount > 1 ? 's' : ''}` : 'Filter'}
						variant={filtersVisible ? 'secondary' : 'tertiary'}
						size="sm"
						on-click={() => updateState({ filtersVisible: !filtersVisible })}
					/>
				) : null}
				{effEnableSort ? (
					<div className="dt-chip-wrap">
						<now-button
							className={`dt-chip${state.openPanel === 'sort' ? ' dt-chip--on' : ''}`}
							icon="sort-outline"
							label={sortChipLabel}
							variant="tertiary"
							size="sm"
							on-click={() => updateState({ openPanel: state.openPanel === 'sort' ? null : 'sort' })}
						/>
						{state.openPanel === 'sort' ? (
							<div className="dt-panel">
								<div className="dt-panel-head">Sort by</div>
								<div className="dt-panel-list">
									{columns.map((c) => {
										const active = String(sortField || '').replace(/^-/, '') === c.field;
										return (
											<button type="button" className={`dt-panel-item${active ? ' dt-panel-item--on' : ''}`} on-click={() => dispatch(A.SORT, { field: c.field })}>
												<span className="dt-panel-item-label">{c.label}</span>
												<span className="dt-panel-dir">{active ? (sortDesc ? '↓ Desc' : '↑ Asc') : ''}</span>
											</button>
										);
									})}
								</div>
								<div className="dt-panel-foot"><now-button label="Clear sort" variant="tertiary" size="sm" on-click={() => dispatch('DT#SORT_CLEAR')} /></div>
							</div>
						) : null}
					</div>
				) : null}
				{effEnableGroupBy ? (
					<div className="dt-chip-wrap">
						<now-button
							className={`dt-chip${state.openPanel === 'group' ? ' dt-chip--on' : ''}`}
							icon="book-outline"
							label={groupChipLabel}
							variant="tertiary"
							size="sm"
							on-click={() => updateState({ openPanel: state.openPanel === 'group' ? null : 'group' })}
						/>
						{state.openPanel === 'group' ? (
							<div className="dt-panel">
								<div className="dt-panel-head">Group by</div>
								<div className="dt-panel-list">
									<button type="button" className={`dt-panel-item${!grp ? ' dt-panel-item--on' : ''}`} on-click={() => dispatch('DT#GROUP', { field: '' })}>
										<span className="dt-panel-item-label">— None —</span>
									</button>
									{columns.map((c) => (
										<button type="button" className={`dt-panel-item${grp === c.field ? ' dt-panel-item--on' : ''}`} on-click={() => dispatch('DT#GROUP', { field: c.field })}>
											<span className="dt-panel-item-label">{c.label}</span>
										</button>
									))}
								</div>
							</div>
						) : null}
					</div>
				) : null}
			</div>
			<div className="dt-toolbar-right">
				{!viewOnly && props.showListActions ? listActions.map((a) => (
					<now-button
						className="dt-listaction"
						label={a.label}
						variant="secondary"
						size="sm"
						tooltipContent={a.hint || undefined}
						on-click={() => emit(dispatch, 'LIST_ACTION', { name: a.name || '', sysId: a.sysId || '', label: a.label || '' })}
					/>
				)) : null}
				{!viewOnly && props.showRefresh ? (
					<now-button-iconic
						className="dt-refresh"
						icon="refresh-outline"
						variant="secondary"
						size="sm"
						tooltipContent="Refresh"
						configAria={{ button: { 'aria-label': 'Refresh' } }}
						on-click={() => dispatch('DT#REFRESH')}
					/>
				) : null}
				{!viewOnly && props.showReset ? (
					<now-button
						className="dt-reset"
						label="Reset"
						icon="filter-outline"
						variant="secondary"
						size="sm"
						on-click={() => dispatch('DT#RESET')}
					/>
				) : null}
				{!viewOnly && props.showExport ? (
					<now-button
						className="dt-export"
						label="Export"
						variant="secondary"
						size="sm"
						on-click={() => emit(dispatch, 'EXPORT', { table, query: currentQuery(props, state) })}
					/>
				) : null}
				{!viewOnly && showDropdown ? (
					<now-dropdown
						className="dt-dropdown"
						items={dropdownItems}
						placeholder={dropdownPlaceholder || 'Actions'}
						variant="secondary"
						size="sm"
						select="none"
					/>
				) : null}
				{!viewOnly && showAddNew ? (
					<now-button
						className="dt-addnew"
						label={addNewLabel || 'New'}
						variant="primary"
						size="sm"
						icon="plus-outline"
						on-click={() => { if (enableDrawer) updateState({ drawerOpen: true, drawerSysId: '-1' }); emit(dispatch, 'ADD_NEW', { table, sysId: '-1' }); }}
					/>
				) : null}
				{(() => {
					// "More actions" is an OVERFLOW menu: it only offers standard actions whose
					// own toolbar button is turned OFF (so nothing is duplicated). The configurable
					// items live in the separate "Actions" dropdown, not here.
					if (viewOnly || props.showMoreActions === false) return null;
					const moreItems = []
						.concat(props.showRefresh ? [] : [{ id: 'ma::refresh', label: 'Refresh', icon: 'refresh-outline' }])
						.concat(props.showReset ? [] : [{ id: 'ma::reset', label: 'Reset', icon: 'filter-outline' }])
						.concat(props.showExport ? [] : [{ id: 'ma::export', label: 'Export', icon: 'download-outline' }]);
					if (!moreItems.length) return null;
					return (
						<now-dropdown
							className="dt-more"
							icon="ellipsis-v-outline"
							items={moreItems}
							placeholder="More actions"
							variant="tertiary"
							size="sm"
							bare
							hideCaret={true}
							select="none"
							tooltipContent="More actions"
							configAria={{ button: { 'aria-label': 'More actions' } }}
						/>
					);
				})()}
			</div>
		</div>
	);

	if (loading) {
		return (
			<div className="dt-root dt-root--msg">
				{toolbar}
				<div className="dt-loading"><now-loader label="Loading records…" size="lg" /></div>
			</div>
		);
	}
	if (error) {
		return (
			<div className="dt-root dt-root--msg">
				{toolbar}
				<div className="dt-error" role="alert">{error}</div>
			</div>
		);
	}

	const size = effSize(state);
	const sizeOptions = parseSizes(pageSizes, size);
	const total = Number(state.total) || 0;
	const safePage = Math.max(0, Number(page) || 0);
	const start = safePage * size;
	const pageRows = list;

	/* ---- group model (when group-by active) ---- *
	 * Server-side paging → group membership / counts are within the LOADED page.
	 * Collapse state is client-side (state.collapsedGroups, keyed by group value). */
	const collapsedGroups = state.collapsedGroups || {};
	const groupKeyOf = (row) => {
		const gv = dispVal(row[grp]) != null && dispVal(row[grp]) !== '' ? dispVal(row[grp]) : rawVal(row[grp]);
		return String(gv == null ? '' : gv);
	};
	const groupCounts = {};
	const groupKeys = [];
	if (grp) {
		pageRows.forEach((row) => {
			const k = groupKeyOf(row);
			if (groupCounts[k] == null) groupKeys.push(k);
			groupCounts[k] = (groupCounts[k] || 0) + 1;
		});
	}
	const allGroupsCollapsed = grp && groupKeys.length > 0 && groupKeys.every((k) => collapsedGroups[k]);

	/* ---- header cell (label + sort/filter/group state icons + ⋮ actions menu + drag/resize) ---- */
	const sortIndicator = (field) => {
		if (!effEnableSort || state.sortField !== field) return null;
		return <span className="dt-sort">{state.sortDir === 'desc' ? '▼' : '▲'}</span>;
	};
	const colFilterActive = (f) => { const cf = colFilters[f]; return !!(cf && filterClause(f, cf.op, cf.value)); };
	const showColMenu = !viewOnly && props.showColumnMenu !== false;
	const headerCell = (c) => (
		<th
			scope="col"
			className={`dt-th${effEnableSort ? ' dt-th--sortable' : ''}`}
			style={widths[c.field] ? { width: `${widths[c.field]}px` } : undefined}
			attrs={effEnableReorder ? { draggable: 'true' } : undefined}
			on-click={effEnableSort ? () => dispatch(A.SORT, { field: c.field }) : undefined}
			on-dragstart={effEnableReorder ? () => { dragField = c.field; } : undefined}
			on-dragover={effEnableReorder ? (e) => e.preventDefault() : undefined}
			on-drop={effEnableReorder ? (e) => {
				e.preventDefault();
				if (dragField && dragField !== c.field) {
					const fields = columns.map((x) => x.field);
					const from = fields.indexOf(dragField);
					const to = fields.indexOf(c.field);
					if (from >= 0 && to >= 0) { fields.splice(to, 0, fields.splice(from, 1)[0]); dispatch(A.REORDER, { order: fields }); }
				}
				dragField = null;
			} : undefined}
		>
			<span className="dt-th-label">
				{c.label}
				{sortIndicator(c.field)}
				{colFilterActive(c.field) ? <now-icon className="dt-th-stateicon" icon="filter-outline" size="sm" /> : null}
				{grp === c.field ? <now-icon className="dt-th-stateicon" icon="book-outline" size="sm" /> : null}
			</span>
			{showColMenu ? (
				/* Column ⋮ actions — a portaled now-dropdown (escapes the scroll clip);
				 * stop the click bubbling so it doesn't also trigger the header sort. */
				<span className="dt-th-menu-wrap" on-click={(e) => e.stopPropagation()}>
					<now-dropdown
						className="dt-th-menu"
						icon="ellipsis-v-outline"
						items={[]
							.concat(effEnableSort ? [{ id: `sa::${c.field}`, label: 'Sort ascending' }, { id: `sd::${c.field}`, label: 'Sort descending' }] : [])
							.concat([{ id: `fl::${c.field}`, label: 'Filter…', icon: 'filter-outline' }])
							.concat(effEnableGroupBy ? [{ id: `gb::${c.field}`, label: grp === c.field ? 'Remove grouping' : 'Group by this column', icon: 'book-outline' }] : [])}
						placeholder=""
						variant="tertiary"
						size="sm"
						bare
						hideCaret={true}
						select="none"
						tooltipContent="Column actions"
						configAria={{ button: { 'aria-label': `Actions for ${c.label}` } }}
					/>
				</span>
			) : null}
			{effEnableResize ? (
				<span
					className="dt-resize"
					on-click={(e) => e.stopPropagation()}
					on-mousedown={(e) => {
						e.preventDefault(); e.stopPropagation();
						const th = e.target.parentNode;
						const startX = e.clientX;
						const startW = widths[c.field] || (th && th.offsetWidth) || 160;
						const move = (ev) => dispatch(A.RESIZE, { field: c.field, width: Math.max(60, startW + (ev.clientX - startX)) });
						const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
						document.addEventListener('mousemove', move);
						document.addEventListener('mouseup', up);
					}}
				/>
			) : null}
		</th>
	);
	const actionsHeader = anyRowActions ? <th scope="col" className={`dt-th dt-th-actions${actionsSticky ? ' dt-sticky' : ''}`}>{actionsLabel || 'Actions'}</th> : null;

	/* ---- leading column: filter (funnel) toggle icon (native-list manner; no checkbox) ---- */
	const leadHeader = leadCol ? (
		<th scope="col" className="dt-th dt-th-lead">
			<now-button-iconic
				className="dt-filter-toggle"
				icon="filter-outline"
				variant={filtersVisible ? 'primary' : 'tertiary'}
				size="sm"
				bare
				tooltipContent={filtersVisible ? 'Hide filters' : 'Show filters'}
				configAria={{ button: { 'aria-label': 'Toggle filters' } }}
				on-click={() => updateState({ filtersVisible: !filtersVisible })}
			/>
		</th>
	) : null;

	/* ---- per-column filter row (shown/hidden client-side via the Filter chip / icon) ---- */
	const filterRow = filtersVisible ? (
		<tr className="dt-filter-row">
			{leadCol ? <td className="dt-filter-lead dt-filter-cell--lead"><span className="dt-filter-lead-label">Filter</span></td> : null}
			{actionsFirst && anyRowActions ? <td className="dt-filter-actions" /> : null}
			{columns.map((c) => {
				const cur = colFilters[c.field] || {};
				// Choice columns (sys_choice, non-dot-walked) get a multi-select "Edit filter"
				// picker showing "N values selected" — like the native list.
				const choiceList = (c.field.indexOf('.') < 0 && state.choices && state.choices[c.field]) || null;
				if (choiceList && choiceList.length) {
					const selected = cur.value ? String(cur.value).split(',').filter((x) => x !== '') : [];
					const items = choiceList.map((o) => ({ id: `mc::${c.field}::${o.value}`, label: o.label }));
					const selectedItems = selected.map((v) => `mc::${c.field}::${v}`);
					const ph = selected.length ? `${selected.length} value${selected.length > 1 ? 's' : ''} selected` : 'Edit filter';
					return (
						<td className="dt-filter-cell">
							<now-dropdown
								className="dt-filter-choice"
								items={items}
								selectedItems={selectedItems}
								placeholder={ph}
								variant="tertiary"
								size="sm"
								select="multi"
							/>
						</td>
					);
				}
				const op = cur.op || '=';
				const opItems = OPERATORS.map((o) => ({ id: `op::${c.field}::${o.id}`, label: o.label }));
				return (
					<td className="dt-filter-cell">
						<div className="dt-filter-op-row">
							{/* now-dropdown (not now-select) so the operator options render as a
							    proper visible menu on the instance; built-in "Operator" form label. */}
							<now-dropdown
								className="dt-filter-op"
								items={opItems}
								selectedItems={[`op::${c.field}::${op}`]}
								label="Operator"
								labelPosition="start"
								labelSize="sm"
								variant="tertiary"
								size="sm"
								select="single"
								placeholder="is"
							/>
						</div>
						{NO_VALUE_OPS[op] ? null : (
							<now-input
								className="dt-filter-val"
								name={`cf::${c.field}`}
								type="text"
								placeholder="Value"
								value={cur.value || ''}
								size="sm"
							/>
						)}
					</td>
				);
			})}
			{!actionsFirst && anyRowActions ? <td className={`dt-filter-actions${actionsSticky ? ' dt-sticky' : ''}`} /> : null}
		</tr>
	) : null;

	/* ---- cell rendering ---- */
	const renderCell = (col, row, sysId) => {
		const cell = row[col.field];
		const raw = rawVal(cell);
		const disp = dispVal(cell);

		// Inline edit control for this exact cell — typed like a form field
		// (choice → select, reference → typeahead, date/datetime → date picker,
		// boolean → select, number → number input, else text). The typed control only
		// stages a PENDING value; it is committed (PATCH) when the user clicks Apply
		// (the inline Cancel button discards it).
		if (effEnableInlineEdit && editingCell && editingCell.sysId === sysId && editingCell.field === col.field) {
			const f = col.field;
			const cur = editingCell.value != null ? String(editingCell.value) : (raw != null ? String(raw) : '');
			const choiceList = (f.indexOf('.') < 0 && choices[f]) || null;
			const meta = fieldMeta[f] || {};
			let control;
			if (choiceList && choiceList.length) {
				const items = [{ id: 'ie::', label: '— None —' }].concat(choiceList.map((o) => ({ id: `ie::${o.value}`, label: o.label })));
				control = <now-dropdown className="dt-inline-input" items={items} selectedItems={[`ie::${cur}`]} size="sm" select="single" placeholder="— None —" />;
			} else if (meta.type === 'reference') {
				const refText = editingCell.display != null ? editingCell.display : (disp != null ? String(disp) : '');
				control = (
					<now-typeahead
						className="dt-inline-input"
						name="ie"
						items={state.ieItems || []}
						value={refText}
						selectedItem={cur ? `ie::${cur}` : null}
						search="managed"
						placeholder="Type to search…"
					/>
				);
			} else if (meta.type === 'date' || meta.type === 'datetime') {
				const isDt = meta.type === 'datetime';
				control = <now-date-time className="dt-inline-input" name="ie" type={isDt ? 'date-time' : 'date'} format={isDt ? 'yyyy-MM-dd HH:mm:ss' : 'yyyy-MM-dd'} value={cur} />;
			} else if (meta.type === 'boolean') {
				const v = (cur === 'true' || cur === '1') ? 'true' : 'false';
				control = <now-dropdown className="dt-inline-input" items={[{ id: 'ie::true', label: 'true' }, { id: 'ie::false', label: 'false' }]} selectedItems={[`ie::${v}`]} size="sm" select="single" placeholder="false" />;
			} else {
				control = <now-input className="dt-inline-input" name="ie" type={meta.type === 'number' ? 'number' : 'text'} value={cur} />;
			}
			return (
				<div className="dt-inline">
					{control}
					<div className="dt-inline-actions">
						<now-button-iconic
							className="dt-inline-apply"
							icon="check-outline"
							variant="primary"
							size="sm"
							tooltipContent="Apply"
							configAria={{ button: { 'aria-label': 'Apply' } }}
							on-click={(e) => { e.stopPropagation(); dispatch('DT#IE_APPLY'); }}
						/>
						<now-button-iconic
							className="dt-inline-cancel"
							icon="close-outline"
							variant="tertiary"
							size="sm"
							tooltipContent="Cancel"
							configAria={{ button: { 'aria-label': 'Cancel' } }}
							on-click={(e) => { e.stopPropagation(); updateState({ editingCell: null, ieItems: [] }); }}
						/>
					</div>
				</div>
			);
		}

		// HTML columns are auto-detected from the field type and rendered (not escaped).
		// innerHTML via props (no JSX <svg>).
		if (isHtmlField(col.field)) {
			const html = raw != null && raw !== '' ? raw : disp;
			if (html == null || html === '') return <span className="dt-empty">—</span>;
			return <div className="dt-html" props={{ innerHTML: String(html) }} />;
		}

		// Dates always render in pretty format ("Mon D, YYYY").
		let text = disp != null && disp !== '' ? disp : raw;
		text = prettyDate(raw, text);
		if (text == null || text === '') return <span className="dt-empty">—</span>;

		// Highlighted-value cell.
		if (hvSet.has(col.field)) {
			return <now-highlighted-value label={String(text)} color={hvColor(statusTone(raw != null ? raw : text))} variant="secondary" />;
		}
		// Clickable reference cell (display value as a hyperlink).
		if (enableReferenceLinks) {
			const ref = parseRefLink(linkVal(cell));
			if (ref) {
				return (
					<a
						className="dt-reflink"
						href="javascript:void(0)"
						on-click={(e) => {
							e.preventDefault(); e.stopPropagation();
							emit(dispatch, 'REFERENCE_CLICK', { table: ref.table, sysId: ref.sysId, field: col.field, query: currentQuery(props, state) });
							if ((referenceOpenIn || 'side') === 'newTab') openInNewTab(ref.table, ref.sysId);
							else if (enableDrawer) updateState({ drawerOpen: true, drawerSysId: ref.sysId });
						}}
					>{highlightMatches(text, searchTerm)}</a>
				);
			}
		}
		return highlightMatches(text, searchTerm);
	};

	/* ---- per-row action buttons ---- */
	const iconBtn = (icon, label, evName, sysId) => (
		<now-button-iconic
			className="dt-action"
			icon={icon}
			variant="tertiary"
			size="sm"
			bare
			tooltipContent={label}
			configAria={{ button: { 'aria-label': label } }}
			on-click={(e) => {
				e.stopPropagation();
				// Any row action (Edit, Duplicate, custom) opens the side form view — only
				// Delete is excluded (it has its own confirm + built-in delete).
				if (enableDrawer) updateState({ drawerOpen: true, drawerSysId: sysId });
				emit(dispatch, evName, { sysId, table });
			}}
		/>
	);
	const customBtn = (btn, sysId) => (
		<now-button-iconic
			className="dt-action dt-action--custom"
			icon={btn.icon || 'dot-point-outline'}
			variant="tertiary"
			size="sm"
			bare
			tooltipContent={btn.label || btn.id}
			configAria={{ button: { 'aria-label': btn.label || btn.id || 'Action' } }}
			on-click={(e) => { e.stopPropagation(); if (enableDrawer) updateState({ drawerOpen: true, drawerSysId: sysId }); emit(dispatch, 'CUSTOM_ACTION', { actionId: btn.id || '', sysId, table }); }}
		/>
	);
	// Delete is a BUILT-IN action: it asks for confirmation, then DELETEs the record
	// over the Table API (no event wiring required).
	const deleteBtn = (sysId) => (
		<now-button-iconic
			className="dt-action"
			icon={deleteIcon || 'trash-outline'}
			variant="tertiary"
			size="sm"
			bare
			tooltipContent="Delete"
			configAria={{ button: { 'aria-label': 'Delete' } }}
			on-click={(e) => { e.stopPropagation(); updateState({ confirmDelete: sysId }); }}
		/>
	);
	const actionsCell = (sysId) => (
		<td className={`dt-actions-cell${actionsSticky ? ' dt-sticky' : ''}`}>
			<div className="dt-actions">
				{showEdit ? iconBtn(editIcon || 'pencil-outline', 'Edit', 'EDIT_ACTION', sysId) : null}
				{showCopy ? iconBtn(copyIcon || 'copy-outline', 'Duplicate', 'COPY_ACTION', sysId) : null}
				{showDelete ? deleteBtn(sysId) : null}
				{customButtons.map((b) => customBtn(b, sysId))}
			</div>
		</td>
	);

	/* ---- row click behavior ---- */
	const onRowClick = (sysId) => {
		emit(dispatch, 'ROW_CLICK', { sysId, table }); // always (backward-compatible)
		const mode = rowClickAction || 'none';
		if (mode === 'expand') {
			updateState({ expandedRows: { ...expanded, [sysId]: !expanded[sysId] } });
		} else if (mode === 'openRecord') {
			emit(dispatch, 'OPEN_RECORD', { sysId, table, openIn: openRecordIn || 'side' });
			if ((openRecordIn || 'side') === 'newTab') openInNewTab(table, sysId);
			else if (enableDrawer) updateState({ drawerOpen: true, drawerSysId: sysId });
		}
	};

	/* ---- body rows (with optional group headers + expand detail) ---- */
	const bodyRows = [];
	let lastGroup = null;
	let dataRowIdx = -1;
	pageRows.forEach((row) => {
		const sysId = rawVal(row.sys_id);
		// Group header when the group value changes within this (server-sorted) page.
		if (grp) {
			const gkey = groupKeyOf(row);
			if (gkey !== lastGroup) {
				lastGroup = gkey;
				const isCollapsed = !!collapsedGroups[gkey];
				bodyRows.push(
					<tr className="dt-group-row">
						<td colSpan={colCount}>
							<button type="button" className="dt-group-toggle" on-click={() => dispatch('DT#GROUP_TOGGLE', { key: gkey })} aria-expanded={isCollapsed ? 'false' : 'true'}>
								<now-icon className="dt-group-caret" icon={isCollapsed ? 'caret-right-fill' : 'caret-down-fill'} size="sm" />
								<span className="dt-group-label">{gkey || '(empty)'}</span>
								<span className="dt-group-count">{groupCounts[gkey] || 0}</span>
							</button>
						</td>
					</tr>
				);
			}
			if (collapsedGroups[gkey]) return; // hide data rows of a collapsed group
		}
		dataRowIdx += 1;
		const hl = highlightRules.length ? rowHighlightColor(highlightRules, row) : '';
		const alt = zebra && (dataRowIdx % 2 === 1);
		const cells = columns.map((c, ci) => {
			const cellStyle = {};
			if (widths[c.field]) cellStyle.width = `${widths[c.field]}px`;
			if (wrapChars) cellStyle.maxWidth = `${wrapChars}ch`;
			return (
				<td
					className={`dt-td${ci === 0 ? ' dt-td--primary' : ''}${wrapChars ? ' dt-wrap' : ''}`}
					style={Object.keys(cellStyle).length ? cellStyle : undefined}
					on-dblclick={effEnableInlineEdit && !isHtmlField(c.field)
						? (e) => {
							e.stopPropagation();
							updateState({
								editingCell: {
									sysId,
									field: c.field,
									value: rawVal(row[c.field]) != null ? String(rawVal(row[c.field])) : '',
									display: dispVal(row[c.field]) != null ? String(dispVal(row[c.field])) : '',
								},
								ieItems: [],
							});
						}
						: undefined}
				>{renderCell(c, row, sysId)}</td>
			);
		});
		bodyRows.push(
			<tr
				className={`dt-row${(rowClickAction || 'none') !== 'none' ? ' dt-row--clickable' : ''}${hl ? ' dt-row--hl' : ''}${alt ? ' dt-row--alt' : ''}`}
				style={hl ? { background: hl } : undefined}
				tabindex="0"
				on-click={() => onRowClick(sysId)}
				on-keydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onRowClick(sysId); } }}
			>
				{leadCol ? <td className="dt-td dt-td-lead" /> : null}
				{actionsFirst && anyRowActions ? actionsCell(sysId) : null}
				{cells}
				{!actionsFirst && anyRowActions ? actionsCell(sysId) : null}
			</tr>
		);
		// Expand detail row.
		if ((rowClickAction === 'expand') && expanded[sysId]) {
			bodyRows.push(
				<tr className="dt-expand-row">
					<td colSpan={colCount}>
						<div className="dt-expand">
							{columns.map((c) => {
								const t = dispVal(row[c.field]) != null && dispVal(row[c.field]) !== '' ? dispVal(row[c.field]) : rawVal(row[c.field]);
								return <div className="dt-expand-item"><span className="dt-expand-k">{c.label}</span><span className="dt-expand-v">{t == null || t === '' ? '—' : String(t)}</span></div>;
							})}
						</div>
					</td>
				</tr>
			);
		}
	});

	const rangeStart = pageRows.length === 0 ? 0 : start + 1;
	const rangeEnd = start + pageRows.length;
	const effectiveQuery = currentQuery(props, state);

	return (
		<div className="dt-root">
			{toolbar}
			{showQuery ? (
				<div className="dt-querybar"><span className="dt-querybar-k">Query</span><code className="dt-querybar-v">{effectiveQuery || '(none)'}</code></div>
			) : null}

			<div className="dt-scroll">
				<table className="dt-table">
					<thead>
						<tr>
							{leadHeader}
							{actionsFirst ? actionsHeader : null}
							{columns.map((c) => headerCell(c))}
							{!actionsFirst ? actionsHeader : null}
						</tr>
						{filterRow}
					</thead>
					<tbody className={zebra ? 'dt-zebra' : undefined}>
						{pageRows.length === 0 ? (
							<tr className="dt-empty-row"><td colSpan={colCount}>{emptyMessage || 'No records found'}</td></tr>
						) : bodyRows}
					</tbody>
				</table>
			</div>

			<div className="dt-footer">
				<div className="dt-footer-left">
					<div className="dt-range">
						Showing <b>{rangeStart}-{rangeEnd}</b> of <b>{total}</b>{itemLabel ? ` ${itemLabel}` : ''}
					</div>
					{grp && groupKeys.length ? (
						<now-button
							className="dt-groups-toggle"
							label={allGroupsCollapsed ? 'Expand all' : 'Collapse all'}
							icon={allGroupsCollapsed ? 'caret-right-fill' : 'caret-down-fill'}
							variant="tertiary"
							size="sm"
							on-click={() => dispatch('DT#GROUP_TOGGLE_ALL', { keys: groupKeys, collapse: !allGroupsCollapsed })}
						/>
					) : null}
				</div>
				<now-pagination-control
					className="dt-pager"
					total={total}
					selectedPage={safePage}
					selectedPageSize={size}
					pageSizes={sizeOptions}
					pageSizeLabel={pageSizeLabel || 'Per page'}
					manageSelectedPage={true}
					manageSelectedPageSize={true}
					hideRange={true}
					hidePageSizeControl={!showPageSizeControl}
				/>
			</div>

			{enableDrawer ? (
				<div className={`dt-drawer-wrap${state.drawerOpen ? ' dt-drawer-wrap--open' : ''}`}>
					<div className="dt-overlay" on-click={() => updateState({ drawerOpen: false })} />
					<div className="dt-drawer" style={{ width: state.drawerWidthPx ? `${state.drawerWidthPx}px` : (drawerWidth || '480px') }} role="dialog" aria-modal="true">
						{/* Drag the left edge to resize the pane. */}
						<div
							className="dt-drawer-resize"
							on-mousedown={(e) => {
								e.preventDefault();
								const move = (ev) => {
									const w = Math.max(320, Math.min(window.innerWidth - ev.clientX, window.innerWidth * 0.95));
									dispatch(A.DRAWER_RESIZE, { width: w });
								};
								const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
								document.addEventListener('mousemove', move);
								document.addEventListener('mouseup', up);
							}}
						/>
						<div className="dt-drawer-head">
							<span className="dt-drawer-title">{drawerTitle || 'Details'}</span>
							<now-button-iconic icon="close-outline" variant="tertiary" size="sm" bare tooltipContent="Close" on-click={() => updateState({ drawerOpen: false })} />
						</div>
						<div className="dt-drawer-body">
							<slot name="form">
								<div className="dt-drawer-empty">Drop a <b>Dynamic Form</b> (or any component) here in UI Builder. Bind its <b>Record sys_id</b> to this list's <code>EDIT_ACTION</code> / <code>ADD_NEW</code> event (use <code>-1</code> for a new record).</div>
							</slot>
						</div>
					</div>
				</div>
			) : null}

			{state.confirmDelete ? (
				<div className="dt-confirm-wrap">
					<div className="dt-overlay" on-click={() => updateState({ confirmDelete: null })} />
					<div className="dt-confirm" role="alertdialog" aria-modal="true">
						<div className="dt-confirm-title">Delete record?</div>
						<div className="dt-confirm-msg">This permanently deletes the record. This action can’t be undone.</div>
						<div className="dt-confirm-actions">
							<now-button label="Cancel" variant="secondary" on-click={() => updateState({ confirmDelete: null })} />
							<now-button
								label="Delete"
								variant="primary-negative"
								on-click={() => { const sid = state.confirmDelete; updateState({ confirmDelete: null, deletingSysId: sid, loading: true, error: '' }); dispatch(A.DELETE, { table, sysId: sid }); }}
							/>
						</div>
					</div>
				</div>
			) : null}
		</div>
	);
};

/* ------------------------------------------------------------------ *
 * Element
 * ------------------------------------------------------------------ */
createCustomElement('x-gegis-library-data-table', {
	renderer: { type: snabbdom },
	view,
	styles,
	slots: {
		// Droppable drawer region — authors drop x-gegis-library-dynamic-form (or any
		// component) here in UI Builder. @defaultSlot
		form: {},
	},
	initialState: {
		loading: false,
		error: '',
		rows: [],
		total: 0,
		page: 0,
		size: 0,
		_loadedKey: '',
		_listKey: '',
		_choiceKey: '',
		_dictKey: '',
		listActions: [],
		choices: {},
		fieldMeta: {},
		ieItems: [],
		derivedColumns: null,
		searchOpen: false,
		search: '',
		colFilters: {},
		sortField: '',
		sortDir: '',
		groupBy: '',
		columnOrder: [],
		columnWidths: {},
		expandedRows: {},
		editingCell: null,
		openPanel: null,
		openColMenu: null,
		collapsedGroups: {},
		lastRefreshed: 0,
		confirmDelete: null,
		deletingSysId: '',
		drawerOpen: false,
		drawerSysId: '',
		drawerWidthPx: 0,
		filtersVisible: null,
	},
	properties: {
		/* presentation variant */
		variant: { default: 'default' },
		/* data + columns */
		table: { default: '' },
		query: { default: '' },
		orderBy: { default: '' },
		orderDescending: { default: false },
		fields: { default: '' },
		labels: { default: '' },
		/* paging */
		pageSize: { default: 5 },
		showPageSizeControl: { default: true },
		pageSizes: { default: '5,10,20,50,100' },
		pageSizeLabel: { default: 'Per page' },
		/* header / footer text */
		heading: { default: '' },
		showCount: { default: true },
		showLastRefreshed: { default: true },
		showMoreActions: { default: true },
		showColumnMenu: { default: true },
		itemLabel: { default: 'records' },
		emptyMessage: { default: 'No records found' },
		/* row actions */
		showActions: { default: true },
		showEdit: { default: true },
		showCopy: { default: true },
		showDelete: { default: true },
		actionsLabel: { default: 'Actions' },
		editIcon: { default: 'pencil-outline' },
		copyIcon: { default: 'copy-outline' },
		deleteIcon: { default: 'trash-outline' },
		actionColumnPosition: { default: 'right' },
		customButtons: { default: '' },
		/* search + query builder */
		showGlobalSearch: { default: false },
		globalSearchPlaceholder: { default: 'Search' },
		showColumnFilters: { default: false },
		showFilterToggle: { default: true },
		showFilterIcon: { default: true },
		showQuery: { default: false },
		/* toolbar: list actions, dropdown, add-new */
		showRefresh: { default: true },
		showReset: { default: true },
		showExport: { default: false },
		showListActions: { default: false },
		showDropdown: { default: false },
		dropdownPlaceholder: { default: 'Actions' },
		dropdownItems: { default: '' },
		showAddNew: { default: false },
		addNewLabel: { default: 'Add new' },
		/* drawer */
		enableDrawer: { default: false },
		drawerTitle: { default: 'Details' },
		drawerWidth: { default: '480px' },
		/* row click + references */
		rowClickAction: { default: 'none' },
		openRecordIn: { default: 'side' },
		enableReferenceLinks: { default: false },
		referenceOpenIn: { default: 'side' },
		/* cells */
		highlightedValueFields: { default: '' },
		wrapAtChars: { default: 0 },
		/* appearance */
		zebra: { default: false },
		rowHighlightRules: { default: '' },
		/* sort / group / reorder / resize / inline edit */
		enableSort: { default: true },
		enableGroupBy: { default: false },
		groupByField: { default: '' },
		enableReorder: { default: false },
		enableResize: { default: false },
		enableInlineEdit: { default: false },
	},
	actionHandlers: {
		[actionTypes.COMPONENT_BOOTSTRAPPED]: maybeLoad,
		[actionTypes.COMPONENT_CONNECTED]: maybeLoad,
		[actionTypes.COMPONENT_PROPERTY_CHANGED]: (coeffects) => {
			const { action } = coeffects;
			const name = action && action.payload ? action.payload.propertyName : '';
			if (['table', 'query', 'orderBy', 'orderDescending', 'fields', 'pageSize', 'groupByField', 'enableReferenceLinks', 'showListActions'].indexOf(name) >= 0) maybeLoad(coeffects);
		},

		/* ---- records ---- */
		[A.FETCH]: createHttpEffect('/api/now/table/:table', {
			method: 'GET',
			// batch:false → call the Table API directly; the framework batch endpoint's
			// contract differs on version-skewed instances and 503s
			// [memory: createhttpeffect-batch-false-503].
			batch: false,
			pathParams: ['table'],
			queryParams: ['sysparm_query', 'sysparm_fields', 'sysparm_limit', 'sysparm_offset', 'sysparm_display_value', 'sysparm_exclude_reference_link'],
			successActionType: A.FETCH_OK,
			errorActionType: A.FETCH_ERR,
		}),
		[A.FETCH_OK]: ({ action, state, updateState }) => {
			const rows = resultOf(action) || [];
			const size = effSize(state);
			const headerTotal = totalFromHeaders(action);
			const fallback = Math.max((Number(state.page) || 0) * size + rows.length, Number(state.total) || 0);
			const patch = { rows, total: headerTotal != null ? headerTotal : fallback, loading: false, error: '', lastRefreshed: Date.now() };
			// Remember auto-derived columns from a non-empty page so headers/chips persist
			// when a later filter returns zero rows.
			if (rows.length && !splitList(state.properties.fields).length) {
				patch.derivedColumns = Object.keys(rows[0]).filter((k) => k !== 'sys_id');
			}
			updateState(patch);
		},
		[A.FETCH_ERR]: ({ action, updateState }) =>
			updateState({ rows: [], loading: false, error: `Could not load records: ${errOf(action)}` }),

		/* ---- list / declarative UI actions (sys_ui_action, list context) ---- */
		[A.FETCH_LIST_ACTIONS]: createHttpEffect('/api/now/table/sys_ui_action', {
			method: 'GET',
			batch: false,
			queryParams: ['sysparm_query', 'sysparm_fields', 'sysparm_display_value', 'sysparm_limit'],
			successActionType: A.LIST_ACTIONS_OK,
			errorActionType: A.LIST_ACTIONS_ERR,
		}),
		[A.LIST_ACTIONS_OK]: ({ action, updateState }) => {
			const rows = resultOf(action) || [];
			const listActions = rows.map((r) => ({
				sysId: rawVal(r.sys_id),
				name: rawVal(r.action_name) || rawVal(r.name) || '',
				label: rawVal(r.name) || rawVal(r.action_name) || 'Action',
				hint: rawVal(r.hint) || '',
			})).filter((a) => a.sysId);
			updateState({ listActions });
		},
		[A.LIST_ACTIONS_ERR]: ({ updateState }) => updateState({ listActions: [] }),

		/* ---- choice lists (sys_choice) → choice-column "Edit filter" pickers ---- */
		[A.FETCH_CHOICES]: createHttpEffect('/api/now/table/sys_choice', {
			method: 'GET',
			batch: false,
			queryParams: ['sysparm_query', 'sysparm_fields', 'sysparm_limit'],
			successActionType: A.CHOICES_OK,
			errorActionType: A.CHOICES_ERR,
		}),
		[A.CHOICES_OK]: ({ action, updateState }) => {
			const rows = resultOf(action) || [];
			const choices = {};
			rows.forEach((r) => {
				const el = rawVal(r.element);
				if (!el) return;
				(choices[el] = choices[el] || []).push({ label: rawVal(r.label), value: rawVal(r.value) });
			});
			updateState({ choices });
		},
		[A.CHOICES_ERR]: ({ updateState }) => updateState({ choices: {} }),

		/* ---- field metadata (sys_dictionary) for typed inline-edit controls ---- */
		[A.FETCH_DICT]: createHttpEffect('/api/now/table/sys_dictionary', {
			method: 'GET',
			batch: false,
			queryParams: ['sysparm_query', 'sysparm_fields', 'sysparm_display_value', 'sysparm_limit'],
			successActionType: A.DICT_OK,
			errorActionType: A.DICT_ERR,
		}),
		[A.DICT_OK]: ({ action, updateState }) => {
			const rows = resultOf(action) || [];
			const fieldMeta = {};
			rows.forEach((r) => {
				const el = rawVal(r.element);
				if (!el) return;
				fieldMeta[el] = { type: normType(dispVal(r.internal_type) || rawVal(r.internal_type)), reference: rawVal(r.reference) || '' };
			});
			updateState({ fieldMeta });
		},
		[A.DICT_ERR]: ({ updateState }) => updateState({ fieldMeta: {} }),

		/* ---- inline-edit reference typeahead search ---- */
		[A.IE_REF_SEARCH]: createHttpEffect('/api/now/table/:table', {
			method: 'GET',
			batch: false,
			pathParams: ['table'],
			queryParams: ['sysparm_query', 'sysparm_fields', 'sysparm_display_value', 'sysparm_limit'],
			successActionType: A.IE_REF_OK,
			errorActionType: A.IE_REF_ERR,
		}),
		[A.IE_REF_OK]: ({ action, updateState }) => {
			const rows = resultOf(action) || [];
			const ieItems = rows
				.map((r) => ({ id: `ie::${rawVal(r.sys_id)}`, label: dispVal(r.name) || rawVal(r.name) || rawVal(r.sys_id) }))
				.filter((x) => x.id !== 'ie::');
			updateState({ ieItems });
		},
		[A.IE_REF_ERR]: () => { /* keep prior items */ },

		/* ---- inline edit → PATCH the record ---- */
		[A.INLINE_SAVE]: createHttpEffect('/api/now/table/:table/:sysId', {
			method: 'PATCH',
			batch: false,
			pathParams: ['table', 'sysId'],
			dataParam: 'data',
			queryParams: ['sysparm_display_value'],
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			successActionType: A.INLINE_OK,
			errorActionType: A.INLINE_ERR,
		}),
		[A.INLINE_OK]: ({ action, state, updateState }) => {
			const rec = resultOf(action) || {};
			const sid = rawVal(rec.sys_id);
			// Patch the matching row in-place so the grid reflects the saved value.
			const rows = (state.rows || []).map((row) => {
				if (rawVal(row.sys_id) !== sid) return row;
				const next = { ...row };
				Object.keys(rec).forEach((k) => { next[k] = rec[k]; });
				return next;
			});
			updateState({ rows, editingCell: null, error: '' });
		},
		[A.INLINE_ERR]: ({ action, updateState }) =>
			updateState({ editingCell: null, error: `Could not save: ${errOf(action)}` }),

		/* ---- built-in delete (with confirmation in the view) ---- */
		[A.DELETE]: createHttpEffect('/api/now/table/:table/:sysId', {
			method: 'DELETE',
			batch: false,
			pathParams: ['table', 'sysId'],
			successActionType: A.DELETE_OK,
			errorActionType: A.DELETE_ERR,
		}),
		[A.DELETE_OK]: ({ state, updateState, dispatch }) => {
			// Refetch the current page; also fire DELETE_ACTION so a page can react.
			emit(dispatch, 'DELETE_ACTION', { sysId: state.deletingSysId || '', table: state.properties.table });
			updateState({ deletingSysId: '', loading: true, error: '' });
			fetchPage(dispatch, state.properties, state, Math.max(0, Number(state.page) || 0), effSize(state));
		},
		[A.DELETE_ERR]: ({ action, updateState }) =>
			updateState({ deletingSysId: '', loading: false, error: `Could not delete: ${errOf(action)}` }),

		/* ---- sort / reorder / resize ---- */
		[A.SORT]: (cx) => {
			const field = cx.action.payload && cx.action.payload.field;
			if (!field) return;
			const { state } = cx;
			let dir = 'asc';
			if (state.sortField === field) dir = state.sortDir === 'asc' ? 'desc' : (state.sortDir === 'desc' ? '' : 'asc');
			reload(cx, dir ? { sortField: field, sortDir: dir } : { sortField: '', sortDir: '' });
		},
		[A.REORDER]: ({ action, updateState }) =>
			updateState({ columnOrder: (action.payload && action.payload.order) || [] }),
		[A.RESIZE]: ({ action, state, updateState }) => {
			const p = action.payload || {};
			if (!p.field) return;
			updateState({ columnWidths: { ...(state.columnWidths || {}), [p.field]: p.width } });
		},
		[A.DRAWER_RESIZE]: ({ action, updateState }) => {
			const w = action.payload && action.payload.width;
			if (w) updateState({ drawerWidthPx: w });
		},

		/* ---- toolbar list actions: refresh / reset / clear search ---- */
		'DT#REFRESH': ({ state, updateState, dispatch }) => {
			updateState({ loading: true, error: '' });
			fetchPage(dispatch, state.properties, state, Math.max(0, Number(state.page) || 0), effSize(state));
		},
		'DT#RESET': (cx) => reload(cx, { search: '', colFilters: {}, sortField: '', sortDir: '', groupBy: '' }),
		'DT#SEARCH_CLEAR': (cx) => reload(cx, { search: '' }),
		'DT#SORT_CLEAR': (cx) => { cx.updateState({ openPanel: null }); reload(cx, { sortField: '', sortDir: '' }); },
		'DT#GROUP': (cx) => { cx.updateState({ openPanel: null }); reload(cx, { groupBy: (cx.action.payload && cx.action.payload.field) || '' }); },
		// Group collapse/expand is client-side (no refetch) — keyed by group value.
		'DT#GROUP_TOGGLE': (cx) => {
			const key = cx.action.payload && cx.action.payload.key;
			if (key == null) return;
			const cur = { ...(cx.state.collapsedGroups || {}) };
			if (cur[key]) delete cur[key]; else cur[key] = true;
			cx.updateState({ collapsedGroups: cur });
		},
		'DT#GROUP_TOGGLE_ALL': (cx) => {
			const p = cx.action.payload || {};
			const keys = Array.isArray(p.keys) ? p.keys : [];
			if (!p.collapse) { cx.updateState({ collapsedGroups: {} }); return; }
			const next = {};
			keys.forEach((k) => { next[k] = true; });
			cx.updateState({ collapsedGroups: next });
		},
		// Inline edit: commit the staged value (PATCH) when the user clicks Apply.
		'DT#IE_APPLY': (cx) => { const ec = cx.state.editingCell; if (ec) commitInline(cx, ec.value != null ? ec.value : ''); },
		// Column-header menu: set an explicit sort direction (not the header-click toggle).
		'DT#COL_SORT': (cx) => {
			const p = cx.action.payload || {};
			if (!p.field) return;
			reload(cx, { sortField: p.field, sortDir: p.dir === 'desc' ? 'desc' : 'asc' });
		},

		/* ---- now-input changes (bubbled to host; disambiguate by `name`) ---- */
		'NOW_INPUT#VALUE_SET': (cx) => {
			const p = cx.action.payload || {};
			const name = String(p.name || '');
			const value = p.value != null ? p.value : '';
			if (name === 'gs') {
				reload(cx, { search: value });
			} else if (name.indexOf('cf::') === 0) {
				const field = name.slice(4);
				const cur = (cx.state.colFilters || {})[field] || { op: '=' };
				reload(cx, { colFilters: { ...(cx.state.colFilters || {}), [field]: { ...cur, value } } });
			} else if (name === 'ie') {
				stageIe(cx, value); // stage only; commit on Apply
			}
		},
		// Global search is NOT live/debounced — it runs only on Enter (and on blur via
		// VALUE_SET). Here we just live-stage the inline-edit value so Apply has the latest text.
		'NOW_INPUT#INPUT': (cx) => {
			const p = cx.action.payload || {};
			if (String(p.name || '') === 'ie') {
				stageIe(cx, p.fieldValue != null ? p.fieldValue : (p.value != null ? p.value : ''));
			}
		},
		// Search on Enter (case-insensitive OR-LIKE across the configured columns).
		'NOW_INPUT#ENTER_KEYDOWN': (cx) => {
			const p = cx.action.payload || {};
			if (String(p.name || '') === 'gs') {
				const v = p.value != null ? p.value : (p.fieldValue != null ? p.fieldValue : (cx.state.search || ''));
				reload(cx, { search: String(v) });
			}
		},

		/* ---- now-select changes (operator pickers + group-by) ---- */
		'NOW_SELECT#SELECTED_ITEM_SET': (cx) => {
			const raw = String((cx.action.payload && cx.action.payload.value) || '');
			if (raw.indexOf('op::') === 0) {
				// "op::<field>::<op>"
				const rest = raw.slice(4);
				const i = rest.lastIndexOf('::');
				if (i < 0) return;
				const field = rest.slice(0, i);
				const op = rest.slice(i + 2);
				const cur = (cx.state.colFilters || {})[field] || {};
				const nextFilter = { ...(cx.state.colFilters || {}), [field]: { ...cur, op } };
				// No-value operators apply immediately; value operators wait for input.
				if (NO_VALUE_OPS[op]) reload(cx, { colFilters: nextFilter });
				else cx.updateState({ colFilters: nextFilter });
			} else if (raw.indexOf('grp::') === 0) {
				reload(cx, { groupBy: raw.slice(5) });
			} else if (raw.indexOf('ie::') === 0) {
				// inline-edit choice / boolean select (legacy now-select path) → stage only
				stageIe(cx, raw.slice(4));
			}
		},

		/* inline-edit date/datetime picker → stage only (commit on Apply) */
		'NOW_DATE_TIME#VALUE_SET': (cx) => {
			if (String((cx.action.payload && cx.action.payload.name) || '') === 'ie') stageIe(cx, cx.action.payload.value);
		},

		/* inline-edit reference typeahead: type → debounced search; pick → commit */
		'NOW_TYPEAHEAD#VALUE_SET': (cx) => {
			const p = cx.action.payload || {};
			if (String(p.name || '') !== 'ie') return;
			const ec = cx.state.editingCell;
			if (!ec) return;
			const meta = (cx.state.fieldMeta || {})[ec.field] || {};
			const refTable = meta.reference;
			if (!refTable) return;
			const term = String(p.value || '');
			cx.updateState({ editingCell: { ...ec, display: term } });
			if (ieRefTimer) clearTimeout(ieRefTimer);
			ieRefTimer = setTimeout(() => {
				cx.dispatch(A.IE_REF_SEARCH, {
					table: refTable,
					sysparm_query: term ? `nameLIKE${term}^ORDERBYname` : 'ORDERBYname',
					sysparm_fields: 'sys_id,name',
					sysparm_display_value: 'all',
					sysparm_limit: '25',
				});
			}, 300);
		},
		'NOW_TYPEAHEAD#SELECTED_ITEM_SET': (cx) => {
			const p = cx.action.payload || {};
			const raw = String(p.value || '');
			if (raw.indexOf('ie::') === 0) stageIe(cx, raw.slice(4), p.label != null ? p.label : undefined);
		},

		/* ---- toolbar dropdown chips: sort / group-by / configurable dropdown ---- */
		'NOW_DROPDOWN#ITEM_CLICKED': (cx) => {
			const item = (cx.action.payload && cx.action.payload.item) || {};
			const id = String(item.id == null ? '' : item.id);
			if (id.indexOf('sort::') === 0) {
				// Reuse the header-click sort toggle (asc → desc → off).
				cx.dispatch(A.SORT, { field: id.slice(6) });
			} else if (id.indexOf('grp2::') === 0) {
				reload(cx, { groupBy: id.slice(6) });
			} else if (id === 'ma::refresh') {
				cx.dispatch('DT#REFRESH');
			} else if (id === 'ma::reset') {
				cx.dispatch('DT#RESET');
			} else if (id === 'ma::export') {
				cx.dispatch('EXPORT', { table: cx.state.properties.table, query: currentQuery(cx.state.properties, cx.state) });
			} else if (id.indexOf('mx::') === 0) {
				cx.dispatch('DROPDOWN_SELECT', { id: id.slice(4), label: String(item.label == null ? '' : item.label) });
			} else if (id.indexOf('sa::') === 0) {
				cx.dispatch('DT#COL_SORT', { field: id.slice(4), dir: 'asc' });
			} else if (id.indexOf('sd::') === 0) {
				cx.dispatch('DT#COL_SORT', { field: id.slice(4), dir: 'desc' });
			} else if (id.indexOf('fl::') === 0) {
				cx.updateState({ filtersVisible: true });
			} else if (id.indexOf('gb::') === 0) {
				const f = id.slice(4);
				const cur = activeGroup(cx.state.properties, cx.state);
				reload(cx, { groupBy: cur === f ? '' : f });
			} else if (id.indexOf('op::') === 0 || id.indexOf('mc::') === 0 || id.indexOf('ie::') === 0) {
				// operator / choice-filter / inline-edit dropdowns are handled in
				// SELECTED_ITEMS_SET — don't mistake them for a configurable-dropdown pick.
			} else {
				cx.dispatch('DROPDOWN_SELECT', { id, label: String(item.label == null ? '' : item.label) });
			}
		},

		/* ---- single/multi now-dropdown selections: operator picker (op::), inline-edit
		 *      choice/boolean (ie::), and the choice-column multi filter (mc::) ---- */
		'NOW_DROPDOWN#SELECTED_ITEMS_SET': (cx) => {
			const ids = (cx.action.payload && Array.isArray(cx.action.payload.value)) ? cx.action.payload.value : [];
			const first = String(ids[0] == null ? '' : ids[0]);

			// Operator picker: "op::<field>::<op>" (single select).
			if (first.indexOf('op::') === 0) {
				const rest = first.slice(4);
				const i = rest.lastIndexOf('::');
				if (i < 0) return;
				const field = rest.slice(0, i);
				const op = rest.slice(i + 2);
				const cur = (cx.state.colFilters || {})[field] || {};
				const nextFilter = { ...(cx.state.colFilters || {}), [field]: { ...cur, op } };
				// No-value operators apply immediately; value operators wait for input.
				if (NO_VALUE_OPS[op]) reload(cx, { colFilters: nextFilter });
				else cx.updateState({ colFilters: nextFilter });
				return;
			}

			// Inline-edit choice / boolean (single select) → stage only (commit on Apply).
			if (first.indexOf('ie::') === 0) { stageIe(cx, first.slice(4)); return; }

			// Choice-column multi filter: ids are "mc::<field>::<value>".
			let field = '';
			const values = [];
			ids.forEach((raw) => {
				const r = String(raw);
				if (r.indexOf('mc::') !== 0) return;
				const rest = r.slice(4);
				const i = rest.indexOf('::');
				if (i < 0) return;
				field = rest.slice(0, i);
				values.push(rest.slice(i + 2));
			});
			if (!field) return;
			const cur = { ...(cx.state.colFilters || {}) };
			if (values.length) cur[field] = { op: 'IN', value: values.join(',') };
			else delete cur[field];
			reload(cx, { colFilters: cur });
		},

		/* ---- pagination (manage mode: we own the page + lazily fetch it) ---- */
		'NOW_PAGINATION_CONTROL#SELECTED_PAGE_SET': ({ action, state, updateState, dispatch }) => {
			const raw = action && action.payload ? Number(action.payload.value) : 0;
			const v = Number.isFinite(raw) ? Math.max(0, raw) : 0;
			if (v === state.page && Array.isArray(state.rows) && state.rows.length) return;
			updateState({ page: v, loading: true, error: '' });
			fetchPage(dispatch, state.properties, state, v, effSize(state));
		},
		'NOW_PAGINATION_CONTROL#SELECTED_PAGE_SIZE_SET': ({ action, state, updateState, dispatch }) => {
			const raw = action && action.payload ? Number(action.payload.value) : 0;
			const newSize = Number.isFinite(raw) && raw > 0 ? raw : effSize(state);
			if (newSize === effSize(state)) return;
			const next = { ...state, size: newSize };
			updateState({ size: newSize, page: 0, loading: true, error: '' });
			fetchPage(dispatch, state.properties, next, 0, newSize);
		},
	},
});
