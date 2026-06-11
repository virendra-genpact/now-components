// Tests for x-gegis-library-risk-survey-table — row classification + parsing helpers.

describe('risk-survey-table logic', () => {
	const BULLET_PREFIX_RE = /^[-*•·]\s*/;

	function classifyRows(raw) {
		if (raw == null) return { state: 'empty', rows: [] };
		if (Array.isArray(raw)) return raw.length ? { state: 'ready', rows: raw } : { state: 'empty', rows: [] };
		if (typeof raw === 'string') {
			const trimmed = raw.trim();
			if (!trimmed) return { state: 'empty', rows: [] };
			try { return classifyRows(JSON.parse(trimmed)); } catch (_) { return { state: 'error', rows: [], message: 'Invalid JSON in Rows Data.' }; }
		}
		if (typeof raw === 'object') {
			if (raw.loading === true || raw.isLoading === true) return { state: 'loading', rows: [] };
			const err = raw.error != null ? raw.error : raw.errorMessage;
			if (err) return { state: 'error', rows: [] };
			for (const key of ['rows', 'data', 'items', 'results']) if (Array.isArray(raw[key])) return classifyRows(raw[key]);
		}
		return { state: 'empty', rows: [] };
	}

	function parseSentiments(raw) {
		if (!raw) return [];
		if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
		return String(raw).replace(/\\n/g, '\n').split('\n').map((s) => s.replace(BULLET_PREFIX_RE, '').trim()).filter(Boolean);
	}

	it('classifies arrays, wrappers, strings and loading/error', () => {
		expect(classifyRows([{ a: 1 }]).state).toBe('ready');
		expect(classifyRows([]).state).toBe('empty');
		expect(classifyRows(null).state).toBe('empty');
		expect(classifyRows({ loading: true }).state).toBe('loading');
		expect(classifyRows({ error: 'boom' }).state).toBe('error');
		expect(classifyRows({ data: [{ a: 1 }] }).state).toBe('ready');
		expect(classifyRows('not json').state).toBe('error');
		expect(classifyRows('[{"a":1}]').state).toBe('ready');
	});

	it('parses sentiments from newline text or array, stripping bullets', () => {
		expect(parseSentiments('- a\n- b')).toEqual(['a', 'b']);
		expect(parseSentiments(['x', 'y'])).toEqual(['x', 'y']);
		expect(parseSentiments('one\\ntwo')).toEqual(['one', 'two']);
		expect(parseSentiments('')).toEqual([]);
	});
});
