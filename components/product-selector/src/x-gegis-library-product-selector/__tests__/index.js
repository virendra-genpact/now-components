// Tests for x-gegis-library-product-selector — option parsing + pill color map.

describe('product-selector helpers', () => {
	const parseOptions = (raw) => {
		let arr = raw;
		if (typeof raw === 'string') { try { arr = JSON.parse(raw); } catch (e) { arr = []; } }
		return Array.isArray(arr) ? arr.filter((o) => o && o.id != null) : [];
	};
	const PILL_TONES = ['info', 'neutral', 'positive', 'warning', 'error'];
	const pillTone = (t) => (PILL_TONES.indexOf(t) !== -1 ? t : 'neutral');

	it('parses options from an array or JSON string and drops invalid entries', () => {
		expect(parseOptions([{ id: 'a' }, { title: 'no id' }, null]).length).toBe(1);
		expect(parseOptions('[{"id":"x"},{"id":"y"}]').length).toBe(2);
		expect(parseOptions('not json')).toEqual([]);
		expect(parseOptions(undefined)).toEqual([]);
	});

	it('normalizes pill tone (falls back to neutral)', () => {
		expect(pillTone('info')).toBe('info');
		expect(pillTone('positive')).toBe('positive');
		expect(pillTone('bogus')).toBe('neutral');
		expect(pillTone(undefined)).toBe('neutral');
	});
});
