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
});
