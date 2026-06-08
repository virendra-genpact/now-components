// Tests for x-gegis-library-data-table
//
// Exercises the pure transforms used to turn Table-API responses into the
// render model (kept inline so the test has no platform/runtime deps).
// Rendering/DOM tests run via `snc ui-component test`.

describe('data-table transforms', () => {
	const rawVal = (cell) => (cell && typeof cell === 'object' ? cell.value : cell);
	const dispVal = (cell) => (cell && typeof cell === 'object' ? cell.display_value : cell);

	const splitList = (s) =>
		String(s || '').split(',').map((x) => x.trim()).filter(Boolean);

	const prettify = (s) =>
		String(s || '')
			.replace(/_/g, ' ')
			.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
			.replace(/\b\w/g, (c) => c.toUpperCase());

	const TONE_MAP = {
		published: 'positive', active: 'positive', draft: 'info', archived: 'neutral',
		review: 'warning', rejected: 'error',
	};
	const statusTone = (v) => TONE_MAP[String(v == null ? '' : v).trim().toLowerCase()] || 'neutral';

	const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const prettyDate = (raw, disp) => {
		const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(raw == null ? '' : raw));
		if (!m) return disp;
		return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`;
	};

	const buildQuery = (query, orderBy, desc) => {
		const parts = [];
		if (query) parts.push(query);
		let ob = String(orderBy || '').trim();
		let descending = !!desc;
		if (ob.charAt(0) === '-') { descending = true; ob = ob.slice(1); }
		if (ob) parts.push(descending ? `ORDERBYDESC${ob}` : `ORDERBY${ob}`);
		return parts.join('^');
	};

	const computeColumns = (props, rows) => {
		const fields = splitList(props.fields);
		const labels = splitList(props.labels);
		if (fields.length) return fields.map((f, i) => ({ field: f, label: labels[i] || prettify(f) }));
		const first = rows[0] || {};
		return Object.keys(first).filter((k) => k !== 'sys_id').map((f) => ({ field: f, label: prettify(f) }));
	};

	it('unwraps {value, display_value} cells', () => {
		expect(rawVal({ value: '1', display_value: 'Critical' })).toBe('1');
		expect(dispVal({ value: '1', display_value: 'Critical' })).toBe('Critical');
		expect(rawVal('plain')).toBe('plain');
	});

	it('maps status values to a tone (case-insensitive), unknown -> neutral', () => {
		expect(statusTone('Published')).toBe('positive');
		expect(statusTone('draft')).toBe('info');
		expect(statusTone('Archived')).toBe('neutral');
		expect(statusTone('whatever')).toBe('neutral');
		expect(statusTone('')).toBe('neutral');
	});

	it('formats ISO date/datetime values as "Mon D, YYYY", passes others through', () => {
		expect(prettyDate('2026-05-01', 'x')).toBe('May 1, 2026');
		expect(prettyDate('2026-01-15 00:00:00', 'x')).toBe('Jan 15, 2026');
		expect(prettyDate('not a date', 'High')).toBe('High');
	});

	it('builds the encoded query with ORDERBY / ORDERBYDESC (desc flag or leading "-")', () => {
		expect(buildQuery('active=true', 'sys_updated_on', false)).toBe('active=true^ORDERBYsys_updated_on');
		expect(buildQuery('active=true', 'sys_updated_on', true)).toBe('active=true^ORDERBYDESCsys_updated_on');
		expect(buildQuery('active=true', '-sys_updated_on', false)).toBe('active=true^ORDERBYDESCsys_updated_on');
		expect(buildQuery('', 'x', true)).toBe('ORDERBYDESCx');
		expect(buildQuery('a=b', '', false)).toBe('a=b');
	});

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

	const parseSizes = (raw, current) => {
		let arr = splitList(raw).map(Number).filter((n) => Number.isFinite(n) && n > 0);
		if (!arr.length) arr = [5, 10, 20, 50, 100];
		if (current > 0 && arr.indexOf(current) < 0) arr.push(current);
		return arr.sort((a, b) => a - b);
	};

	it('parses per-page options, defaults when empty, and includes the current size', () => {
		expect(parseSizes('5,10,20,50', 10)).toEqual([5, 10, 20, 50]);
		expect(parseSizes('', 5)).toEqual([5, 10, 20, 50, 100]);
		expect(parseSizes('10,20', 15)).toEqual([10, 15, 20]); // current injected + sorted
		expect(parseSizes('garbage,,', 25)).toEqual([5, 10, 20, 25, 50, 100]);
	});

	it('reads X-Total-Count from the action meta (object or Headers-like)', () => {
		expect(totalFromHeaders({ meta: { responseHeaders: { 'X-Total-Count': '42' } } })).toBe(42);
		expect(totalFromHeaders({ meta: { responseHeaders: { 'x-total-count': '7' } } })).toBe(7);
		expect(totalFromHeaders({ meta: { responseHeaders: new Map([['X-Total-Count', '5']]) } })).toBe(5);
		expect(totalFromHeaders({ meta: {} })).toBeUndefined();
		expect(totalFromHeaders({})).toBeUndefined();
	});

	it('resolves columns from fields+labels, else derives from the first row', () => {
		const explicit = computeColumns({ fields: 'name,version,status', labels: 'Product,Ver' }, []);
		expect(explicit).toEqual([
			{ field: 'name', label: 'Product' },
			{ field: 'version', label: 'Ver' },
			{ field: 'status', label: 'Status' },
		]);
		const derived = computeColumns({ fields: '', labels: '' }, [{ sys_id: '1', short_description: 'x', state: '2' }]);
		expect(derived).toEqual([
			{ field: 'short_description', label: 'Short Description' },
			{ field: 'state', label: 'State' },
		]);
	});

	/* ---- new list-feature transforms ---- */

	const NO_VALUE_OPS = { ISEMPTY: 1, ISNOTEMPTY: 1 };
	const filterClause = (field, op, value) => {
		if (!field || !op) return '';
		if (NO_VALUE_OPS[op]) return `${field}${op}`;
		const v = String(value == null ? '' : value).trim();
		if (v === '') return '';
		return `${field}${op}${v}`;
	};

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
	const activeGroup = (props, state) =>
		(state && state.groupBy != null && state.groupBy !== '') ? state.groupBy : (props.groupByField || '');
	const currentQuery = (props, state) => {
		const parts = [];
		if (props.query) parts.push(props.query);
		const term = String((state && state.search) || '').trim();
		if (term) parts.push(`123TEXTQUERY321=${term}`);
		const cf = (state && state.colFilters) || {};
		Object.keys(cf).forEach((field) => {
			const clause = filterClause(field, cf[field] && cf[field].op, cf[field] && cf[field].value);
			if (clause) parts.push(clause);
		});
		const base = parts.join('^');
		const order = orderClause(props, state, activeGroup(props, state));
		return base ? (order ? `${base}^${order}` : base) : order;
	};

	const applyColumnOrder = (cols, order) => {
		if (!order || !order.length) return cols;
		const idx = (f) => { const i = order.indexOf(f); return i < 0 ? order.length + 1 : i; };
		return cols
			.map((c, i) => ({ c, i }))
			.sort((a, b) => (idx(a.c.field) - idx(b.c.field)) || (a.i - b.i))
			.map((x) => x.c);
	};

	const parseRefLink = (link) => {
		const m = /\/table\/([^/?#]+)\/([0-9a-f]{32})/i.exec(String(link || ''));
		return m ? { table: m[1], sysId: m[2] } : null;
	};

	const parseJsonArray = (s) => {
		if (Array.isArray(s)) return s;
		const str = String(s || '').trim();
		if (!str) return [];
		try { const v = JSON.parse(str); return Array.isArray(v) ? v : []; } catch (e) { return []; }
	};

	it('builds per-column filter clauses (value, no-value, IN), skipping empties', () => {
		expect(filterClause('state', '=', '2')).toBe('state=2');
		expect(filterClause('short_description', 'LIKE', 'net')).toBe('short_descriptionLIKEnet');
		expect(filterClause('priority', 'IN', '1,2')).toBe('priorityIN1,2');
		expect(filterClause('assigned_to', 'ISEMPTY')).toBe('assigned_toISEMPTY');
		expect(filterClause('state', '=', '   ')).toBe(''); // blank value → skipped
		expect(filterClause('', '=', 'x')).toBe('');
	});

	it('assembles the effective query: fixed filter + global search + column filters + order', () => {
		expect(currentQuery({ query: 'active=true', orderBy: '', groupByField: '' }, {})).toBe('active=true');
		expect(currentQuery({ query: 'active=true' }, { search: 'router' }))
			.toBe('active=true^123TEXTQUERY321=router');
		expect(currentQuery({ query: '' }, { colFilters: { state: { op: '=', value: '2' } } }))
			.toBe('state=2');
		expect(currentQuery(
			{ query: 'active=true', orderBy: 'number', orderDescending: false },
			{ search: 'vpn', colFilters: { priority: { op: 'IN', value: '1,2' } }, groupBy: 'state' }
		)).toBe('active=true^123TEXTQUERY321=vpn^priorityIN1,2^ORDERBYstate^ORDERBYnumber');
	});

	it('lets a runtime sort override the configured orderBy (asc/desc toggle)', () => {
		expect(orderClause({ orderBy: 'number', orderDescending: false }, { sortField: 'priority', sortDir: 'desc' }, ''))
			.toBe('ORDERBYDESCpriority');
		expect(orderClause({ orderBy: 'number', orderDescending: true }, {}, '')).toBe('ORDERBYDESCnumber');
		// group field first, sort second; sort skipped when equal to group
		expect(orderClause({ orderBy: 'state' }, {}, 'state')).toBe('ORDERBYstate');
	});

	it('applies a user column order, keeping unknown columns at the end', () => {
		const cols = [{ field: 'a' }, { field: 'b' }, { field: 'c' }];
		expect(applyColumnOrder(cols, ['c', 'a', 'b'])).toEqual([{ field: 'c' }, { field: 'a' }, { field: 'b' }]);
		expect(applyColumnOrder(cols, ['b'])).toEqual([{ field: 'b' }, { field: 'a' }, { field: 'c' }]);
		expect(applyColumnOrder(cols, [])).toEqual(cols);
	});

	it('parses a reference cell link into { table, sysId }', () => {
		expect(parseRefLink('https://x.service-now.com/api/now/table/sys_user/6816f79cc0a8016401c5a33be04be441'))
			.toEqual({ table: 'sys_user', sysId: '6816f79cc0a8016401c5a33be04be441' });
		expect(parseRefLink('')).toBeNull();
		expect(parseRefLink('not a link')).toBeNull();
	});

	it('parses JSON-array props defensively (blank / invalid → [])', () => {
		expect(parseJsonArray('[{"id":"a"}]')).toEqual([{ id: 'a' }]);
		expect(parseJsonArray('')).toEqual([]);
		expect(parseJsonArray('{not json')).toEqual([]);
		expect(parseJsonArray('{"id":"a"}')).toEqual([]); // object, not array → []
		expect(parseJsonArray([{ id: 'b' }])).toEqual([{ id: 'b' }]);
	});
});
