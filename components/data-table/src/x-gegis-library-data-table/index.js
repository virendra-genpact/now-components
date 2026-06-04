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

/* ------------------------------------------------------------------ *
 * Load chain — fetch the records when table/query/etc change.
 * ------------------------------------------------------------------ */
const maybeLoad = ({ state, updateState, dispatch }) => {
	const { table, query, orderBy, orderDescending, fields, maxRecords } = state.properties;
	if (!table) {
		updateState({ rows: [], loading: false, error: '', page: 0, _loadedKey: '' });
		return;
	}
	const key = `${table}|${query}|${orderBy}|${orderDescending}|${fields}|${maxRecords}`;
	if (key === state._loadedKey) return;
	updateState({ _loadedKey: key, loading: true, error: '', page: 0 });

	const payload = {
		table,
		sysparm_display_value: 'all',
		sysparm_limit: String(Number(maxRecords) > 0 ? Number(maxRecords) : 1000),
		sysparm_exclude_reference_link: 'true',
	};
	const q = buildQuery(query, orderBy, orderDescending);
	if (q) payload.sysparm_query = q;
	// Always include sys_id so row/action events can identify the record.
	const cols = splitList(fields);
	if (cols.length) payload.sysparm_fields = cols.concat(cols.indexOf('sys_id') < 0 ? ['sys_id'] : []).join(',');
	dispatch(A.FETCH, payload);
};

/* Dispatch a record-scoped event ({ sysId, table }). */
const emit = (dispatch, table, name, sysId) => dispatch(name, { sysId: String(sysId || ''), table: String(table || '') });

/* ------------------------------------------------------------------ *
 * View
 * ------------------------------------------------------------------ */
const view = (state, { dispatch }) => {
	const props = state.properties;
	const {
		table, statusField, pageSize, heading, itemLabel,
		showActions, showEdit, showCopy, showDelete, actionsLabel,
		editIcon, copyIcon, deleteIcon, prettyDates, emptyMessage,
	} = props;
	const { loading, error, rows, page } = state;
	const list = Array.isArray(rows) ? rows : [];

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
	const size = Number(pageSize) > 0 ? Number(pageSize) : 5;
	const total = list.length;
	const pageCount = Math.max(1, Math.ceil(total / size));
	const safePage = Math.min(Math.max(0, Number(page) || 0), pageCount - 1);
	const start = safePage * size;
	const pageRows = list.slice(start, start + size);
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

	const rangeStart = total === 0 ? 0 : start + 1;
	const rangeEnd = Math.min(start + size, total);

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
					manageSelectedPage={true}
					hideRange={true}
					hidePageSizeControl={true}
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
		page: 0,
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
		maxRecords: { default: 1000 },
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
			if (['table', 'query', 'orderBy', 'orderDescending', 'fields', 'maxRecords'].indexOf(name) >= 0) maybeLoad(coeffects);
		},

		/* records loaded */
		[A.FETCH]: createHttpEffect('/api/now/table/:table', {
			method: 'GET',
			pathParams: ['table'],
			queryParams: ['sysparm_query', 'sysparm_fields', 'sysparm_limit', 'sysparm_display_value', 'sysparm_exclude_reference_link'],
			successActionType: A.FETCH_OK,
			errorActionType: A.FETCH_ERR,
		}),
		[A.FETCH_OK]: ({ action, updateState }) =>
			updateState({ rows: resultOf(action) || [], loading: false, error: '', page: 0 }),
		[A.FETCH_ERR]: ({ action, updateState }) =>
			updateState({ rows: [], loading: false, error: `Could not load records: ${errOf(action)}` }),

		/* pagination: now-pagination-control is in manage mode, so we own the page */
		'NOW_PAGINATION_CONTROL#SELECTED_PAGE_SET': ({ action, updateState }) => {
			const v = action && action.payload ? Number(action.payload.value) : 0;
			updateState({ page: Number.isFinite(v) ? v : 0 });
		},
	},
});
