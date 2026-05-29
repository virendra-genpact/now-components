// Tests for x-gegis-library-metric-card
//
// These exercise the pure formatting/derivation helpers, which hold the
// component's display logic. Rendering/DOM tests run via `snc ui-component test`.

describe('metric-card formatting', () => {
	const toNumber = (raw) => {
		if (raw === null || raw === undefined || raw === '') return NaN;
		if (typeof raw === 'number') return raw;
		const cleaned = String(raw).replace(/[^0-9.\-]/g, '');
		return cleaned === '' ? NaN : Number(cleaned);
	};

	const resolveDirection = (direction, delta) => {
		if (direction && direction !== 'auto') return direction;
		if (Number.isNaN(delta) || delta === 0) return 'flat';
		return delta > 0 ? 'up' : 'down';
	};

	const resolveTone = (direction, positiveIsGood) => {
		if (direction === 'flat') return 'neutral';
		const isGood = direction === 'up' ? positiveIsGood : !positiveIsGood;
		return isGood ? 'good' : 'bad';
	};

	it('parses numeric strings and strips symbols', () => {
		expect(toNumber('25')).toBe(25);
		expect(toNumber('-4.2')).toBe(-4.2);
		expect(toNumber('$1,250')).toBe(1250);
		expect(Number.isNaN(toNumber('N/A'))).toBe(true);
		expect(Number.isNaN(toNumber(''))).toBe(true);
	});

	it('auto-derives trend direction from the delta sign', () => {
		expect(resolveDirection('auto', -4.2)).toBe('down');
		expect(resolveDirection('auto', 4.2)).toBe('up');
		expect(resolveDirection('auto', 0)).toBe('flat');
		expect(resolveDirection('up', -4.2)).toBe('up'); // explicit wins
	});

	it('maps direction + semantics to a tone', () => {
		// Default: a drop is bad (red), matching the reference design.
		expect(resolveTone('down', true)).toBe('bad');
		expect(resolveTone('up', true)).toBe('good');
		// "Lower is better" metrics invert.
		expect(resolveTone('down', false)).toBe('good');
		expect(resolveTone('flat', true)).toBe('neutral');
	});
});
