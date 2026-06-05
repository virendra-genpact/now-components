import { createCustomElement, actionTypes } from '@servicenow/ui-core';
import snabbdom from '@servicenow/ui-renderer-snabbdom';
import { createHttpEffect } from '@servicenow/ui-effect-http';
import styles from './styles.scss';

/* ------------------------------------------------------------------ *
 * x-gegis-library-data-table
 *
 * A configurable record list / data table for Next Experience (UI Builder).
 * You give it a TABLE name and an encoded QUERY; it talks to the ServiceNow
 * Table API itself (over `@servicenow/ui-effect-http`, so the instance
 * session / auth / scope are used automatically — never a hand-rolled
 * `fetch()`), loads the matching records, and renders them in a paginated
 * table that mirrors the OOTB list look.
 *
 * Composition (per SERVICENOW_CUSTOM_COMPONENT_DEV_RULES §0):
 *   - Action icons  -> `now-button-iconic` (edit / copy / delete)
 *   - Loading state -> `now-loader`
 *   - Pagination    -> `now-pagination-control`
 *   - any icon      -> `now-icon`
 * The table grid itself is our own markup: there is NO default `now-table`
 * primitive in the design system, so the `<table>` scaffold + status pill are
 * hand-rolled (documented exception in the README). They are themed with Now
 * design tokens — no hardcoded brand colors, no shadow-DOM piercing.
 *
 * Events (declared in now-ui.json under `actions` so UI Builder can bind them):
 *   - ROW_CLICK     fired when a row body is clicked
 *   - EDIT_ACTION   fired when the edit icon is clicked
 *   - COPY_ACTION   fired when the copy/duplicate icon is clicked
 *   - DELETE_ACTION fired when the delete icon is clicked
 * Each carries { sysId, table }. The action-icon clicks stopPropagation so they
 * never also trigger the row click.
 *
 * Lessons applied: no `@servicenow/now-*` import in this (deployed) entry — the
 * tags are declared in now-ui.json `innerComponents` and the instance supplies
 * the real Horizon versions [memory: do-not-bundle-now-star-use-horizon];
 * `initialState` + `updateState` (no `state` config key); no JSX <svg>.
 * ------------------------------------------------------------------ */

/* ---- action types ---- */
const A = {
	FETCH: 'DT#FETCH',
	FETCH_OK: 'DT#FETCH_OK',
	FETCH_ERR: 'DT#FETCH_ERR',
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

// sysparm_display_value=all returns { value, display_value } per field.
const rawVal = (cell) => (cell && typeof cell === 'object' ? cell.value : cell);
const dispVal = (cell) => (cell && typeof cell === 'object' ? cell.display_value : cell);

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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// If a raw value looks like an ISO date (date or date/time), render "Mon D, YYYY".
const prettyDate = (raw, disp) => {
	const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(raw == null ? '' : raw));
	if (!m) return disp;
	return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`;
};

/* Build the effective encoded query: the configured filter + optional ORDERBY.
 * `desc` (or a leading "-" on the field) sorts descending. */
const buildQuery = (query, orderBy, desc) => {
	const parts = [];
	if (query) parts.push(query);
	let ob = String(orderBy || '').trim();
	let descending = !!desc;
	if (ob.charAt(0) === '-') { descending = true; ob = ob.slice(1); }
	if (ob) parts.push(descending ? `ORDERBYDESC${ob}` : `ORDERBY${ob}`);
	return parts.join('^');
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

// Read the Table API's X-Total-Count header. The http-effect delivers response
// headers in the success action's META (see ui-effect-http httpEffect.js:
// dispatch(successActionType, data, { ...meta, responseHeaders })).
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

// Effective page size: a runtime override from the per-page selector (state.size)
// wins; otherwise the configured `pageSize` property; otherwise 5.
const effSize = (state) => {
	const s = Number(state.size);
	if (s > 0) return s;
	const p = Number(state.properties.pageSize);
	return p > 0 ? p : 5;
};

// Parse the configured per-page options ("5,10,20,50") to a sorted number list,
// guaranteeing the current size is present so the selector can show it selected.
const parseSizes = (raw, current) => {
	let arr = splitList(raw).map(Number).filter((n) => Number.isFinite(n) && n > 0);
	if (!arr.length) arr = [5, 10, 20, 50, 100];
	if (current > 0 && arr.indexOf(current) < 0) arr.push(current);
	return arr.sort((a, b) => a - b);
};

/* ------------------------------------------------------------------ *
 * Lazy server-side paging — only the rows for the CURRENT page are loaded
 * (sysparm_limit + sysparm_offset). The pager total comes from X-Total-Count.
 * ------------------------------------------------------------------ */
const fetchPage = (dispatch, props, page, size) => {
	const { table, query, orderBy, orderDescending } = props;
	const lim = Number(size) > 0 ? Number(size) : 5;
	const payload = {
		table,
		sysparm_display_value: 'all',
		sysparm_exclude_reference_link: 'true',
		sysparm_limit: String(lim),
		sysparm_offset: String(Math.max(0, Number(page) || 0) * lim),
	};
	const q = buildQuery(query, orderBy, orderDescending);
	if (q) payload.sysparm_query = q;
	// Always include sys_id so row/action events can identify the record.
	const cols = splitList(props.fields);
	if (cols.length) payload.sysparm_fields = cols.concat(cols.indexOf('sys_id') < 0 ? ['sys_id'] : []).join(',');
	dispatch(A.FETCH, payload);
};

const maybeLoad = ({ state, updateState, dispatch }) => {
	const { table, query, orderBy, orderDescending, fields, pageSize } = state.properties;
	if (!table) {
		updateState({ rows: [], total: 0, loading: false, error: '', page: 0, size: 0, _loadedKey: '' });
		return;
	}
	// Reload from page 0 whenever the query identity (incl. page size) changes.
	const key = `${table}|${query}|${orderBy}|${orderDescending}|${fields}|${pageSize}`;
	if (key === state._loadedKey) return;
	const propSize = Number(pageSize) > 0 ? Number(pageSize) : 5;
	// A config change resets any runtime per-page override back to the property.
	updateState({ _loadedKey: key, loading: true, error: '', page: 0, rows: [], total: 0, size: propSize });
	fetchPage(dispatch, state.properties, 0, propSize);
};

/* Dispatch a record-scoped event ({ sysId, table }). */
const emit = (dispatch, table, name, sysId) => dispatch(name, { sysId: String(sysId || ''), table: String(table || '') });

/* ------------------------------------------------------------------ *
 * View
 * ------------------------------------------------------------------ */
const view = (state, { dispatch }) => {
	const props = state.properties;
	const {
		table, statusField, heading, itemLabel,
		showActions, showEdit, showCopy, showDelete, actionsLabel,
		editIcon, copyIcon, deleteIcon, prettyDates, emptyMessage,
		showPageSizeControl, pageSizes, pageSizeLabel,
	} = props;
	const { loading, error, rows, page } = state;
	const list = Array.isArray(rows) ? rows : [];   // already just the current page

	if (!table) {
		return (
			<div className="dt-root dt-root--msg">
				{heading ? <div className="dt-heading">{heading}</div> : null}
				<div className="dt-msg">Configure a <b>Table</b> to load records.</div>
			</div>
		);
	}

	if (loading) {
		return (
			<div className="dt-root dt-root--msg">
				{heading ? <div className="dt-heading">{heading}</div> : null}
				<div className="dt-loading"><now-loader label="Loading records…" size="lg" /></div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="dt-root dt-root--msg">
				{heading ? <div className="dt-heading">{heading}</div> : null}
				<div className="dt-error" role="alert">{error}</div>
			</div>
		);
	}

	const columns = computeColumns(props, list);
	const size = effSize(state);
	const sizeOptions = parseSizes(pageSizes, size);
	const total = Number(state.total) || 0;
	const safePage = Math.max(0, Number(page) || 0);
	const start = safePage * size;
	const pageRows = list;   // server already returned only this page's rows
	const anyActions = !!showActions && (showEdit || showCopy || showDelete);
	const colCount = columns.length + (anyActions ? 1 : 0);

	const renderCell = (col, row) => {
		const cell = row[col.field];
		const raw = rawVal(cell);
		const disp = dispVal(cell);
		// Status field -> colored pill.
		if (statusField && col.field === statusField) {
			const text = disp != null && disp !== '' ? disp : raw;
			if (text == null || text === '') return <span className="dt-empty">—</span>;
			return <span className={`dt-pill dt-pill--${statusTone(raw != null && raw !== '' ? raw : text)}`}>{String(text)}</span>;
		}
		let text = disp != null && disp !== '' ? disp : raw;
		if (prettyDates) text = prettyDate(raw, text);
		if (text == null || text === '') return <span className="dt-empty">—</span>;
		return String(text);
	};

	const actionBtn = (icon, label, evName, sysId) => (
		<now-button-iconic
			className="dt-action"
			icon={icon}
			variant="tertiary"
			size="sm"
			bare
			tooltipContent={label}
			configAria={{ button: { 'aria-label': `${label}` } }}
			on-click={(e) => { e.stopPropagation(); emit(dispatch, table, evName, sysId); }}
		/>
	);

	const rangeStart = pageRows.length === 0 ? 0 : start + 1;
	const rangeEnd = start + pageRows.length;

	return (
		<div className="dt-root">
			{heading ? <div className="dt-heading">{heading}</div> : null}
			<div className="dt-scroll">
				<table className="dt-table">
					<thead>
						<tr>
							{columns.map((c) => <th scope="col">{c.label}</th>)}
							{anyActions ? <th scope="col" className="dt-th-actions">{actionsLabel || 'Actions'}</th> : null}
						</tr>
					</thead>
					<tbody>
						{pageRows.length === 0 ? (
							<tr className="dt-empty-row">
								<td colSpan={colCount}>{emptyMessage || 'No records found'}</td>
							</tr>
						) : pageRows.map((row) => {
							const sysId = rawVal(row.sys_id);
							return (
								<tr
									className="dt-row"
									tabindex="0"
									on-click={() => emit(dispatch, table, 'ROW_CLICK', sysId)}
									on-keydown={(e) => {
										if (e.key === 'Enter') { e.preventDefault(); emit(dispatch, table, 'ROW_CLICK', sysId); }
									}}
								>
									{columns.map((c) => <td>{renderCell(c, row)}</td>)}
									{anyActions ? (
										<td className="dt-actions-cell">
											<div className="dt-actions">
												{showEdit ? actionBtn(editIcon || 'pencil-outline', 'Edit', 'EDIT_ACTION', sysId) : null}
												{showCopy ? actionBtn(copyIcon || 'copy-outline', 'Duplicate', 'COPY_ACTION', sysId) : null}
												{showDelete ? actionBtn(deleteIcon || 'trash-outline', 'Delete', 'DELETE_ACTION', sysId) : null}
											</div>
										</td>
									) : null}
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>

			<div className="dt-footer">
				<div className="dt-range">
					Showing <b>{rangeStart}-{rangeEnd}</b> of <b>{total}</b>{itemLabel ? ` ${itemLabel}` : ''}
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
	initialState: {
		loading: false,
		error: '',
		rows: [],
		total: 0,
		page: 0,
		size: 0,
		_loadedKey: '',
	},
	properties: {
		table: { default: '' },
		query: { default: '' },
		orderBy: { default: '' },
		orderDescending: { default: false },
		fields: { default: '' },
		labels: { default: '' },
		statusField: { default: 'status' },
		pageSize: { default: 5 },
		showPageSizeControl: { default: true },
		pageSizes: { default: '5,10,20,50,100' },
		pageSizeLabel: { default: 'Per page' },
		heading: { default: '' },
		itemLabel: { default: 'records' },
		showActions: { default: true },
		showEdit: { default: true },
		showCopy: { default: true },
		showDelete: { default: true },
		actionsLabel: { default: 'Actions' },
		editIcon: { default: 'pencil-outline' },
		copyIcon: { default: 'copy-outline' },
		deleteIcon: { default: 'trash-outline' },
		prettyDates: { default: true },
		emptyMessage: { default: 'No records found' },
	},
	actionHandlers: {
		[actionTypes.COMPONENT_BOOTSTRAPPED]: maybeLoad,
		[actionTypes.COMPONENT_CONNECTED]: maybeLoad,
		[actionTypes.COMPONENT_PROPERTY_CHANGED]: (coeffects) => {
			const { action } = coeffects;
			const name = action && action.payload ? action.payload.propertyName : '';
			if (['table', 'query', 'orderBy', 'orderDescending', 'fields', 'pageSize'].indexOf(name) >= 0) maybeLoad(coeffects);
		},

		/* records loaded */
		[A.FETCH]: createHttpEffect('/api/now/table/:table', {
			method: 'GET',
			// batch:false → call the Table API directly instead of wrapping it in the
			// framework batch request. The default (batch:true) routes through a batch
			// endpoint whose contract differs between the bundled lib (24.x) and the
			// instance (Zurich), which surfaces as a 503 "Service Unavailable".
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
			// Fallback when the header is absent: at least offset + rows on this page.
			const fallback = Math.max((Number(state.page) || 0) * size + rows.length, Number(state.total) || 0);
			updateState({ rows, total: headerTotal != null ? headerTotal : fallback, loading: false, error: '' });
		},
		[A.FETCH_ERR]: ({ action, updateState }) =>
			updateState({ rows: [], loading: false, error: `Could not load records: ${errOf(action)}` }),

		/* pagination: manage mode → we own the page and lazily fetch it on demand */
		'NOW_PAGINATION_CONTROL#SELECTED_PAGE_SET': ({ action, state, updateState, dispatch }) => {
			const raw = action && action.payload ? Number(action.payload.value) : 0;
			const v = Number.isFinite(raw) ? Math.max(0, raw) : 0;
			if (v === state.page && Array.isArray(state.rows) && state.rows.length) return;
			updateState({ page: v, loading: true, error: '' });
			fetchPage(dispatch, state.properties, v, effSize(state));
		},

		/* per-page selector: manage mode → we own the size; reset to page 0 + refetch */
		'NOW_PAGINATION_CONTROL#SELECTED_PAGE_SIZE_SET': ({ action, state, updateState, dispatch }) => {
			const raw = action && action.payload ? Number(action.payload.value) : 0;
			const newSize = Number.isFinite(raw) && raw > 0 ? raw : effSize(state);
			if (newSize === effSize(state)) return;
			updateState({ size: newSize, page: 0, loading: true, error: '' });
			fetchPage(dispatch, state.properties, 0, newSize);
		},
	},
});
