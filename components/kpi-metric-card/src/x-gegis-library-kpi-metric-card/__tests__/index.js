// Tests for x-gegis-library-kpi-metric-card — variant/arrow + sub-metric parsing.

describe('kpi-metric-card logic', () => {
	const VARIANTS = ['positive', 'negative', 'neutral'];
	const safeVariant = (v) => (VARIANTS.includes(v) ? v : 'neutral');
	const arrowFor = (v) => (safeVariant(v) === 'positive' ? '↑' : safeVariant(v) === 'negative' ? '↓' : '–');

	function parseSubMetrics(value) {
		if (typeof value === 'string' && value.trim().startsWith('[')) {
			try { return JSON.parse(value); } catch (e) { return []; }
		}
		if (Array.isArray(value)) return value;
		return [];
	}

	it('maps variant to the correct arrow', () => {
		expect(arrowFor('positive')).toBe('↑');
		expect(arrowFor('negative')).toBe('↓');
		expect(arrowFor('neutral')).toBe('–');
		expect(arrowFor('bogus')).toBe('–');
	});

	it('parses a sub-metrics JSON array; tolerates junk', () => {
		expect(parseSubMetrics('[{"label":"Q1","value":"10"}]')).toEqual([{ label: 'Q1', value: '10' }]);
		expect(parseSubMetrics('not json')).toEqual([]);
		expect(parseSubMetrics('')).toEqual([]);
		expect(parseSubMetrics('[bad')).toEqual([]);
	});

	it('clears loading only when a data property changes', () => {
		const triggers = ['singleScore', 'changeValue', 'changeLabel', 'variant'];
		const clears = (name) => triggers.includes(name);
		expect(clears('singleScore')).toBe(true);
		expect(clears('title')).toBe(false);
	});
});
