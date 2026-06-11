// Tests for x-gegis-library-stat-card — pure logic the view/handler rely on.

describe('stat-card logic', () => {
	const VARIANTS = ['critical', 'major', 'moderate', 'minor', 'insignificant'];
	const safeVariant = (v) => (VARIANTS.includes(String(v || '').toLowerCase().trim()) ? String(v).toLowerCase().trim() : 'critical');
	const toBool = (v) => v === true || v === 'true';
	const cardClass = (variant, tinted) => `sc-card sc-card--${safeVariant(variant)}` + (tinted ? ' sc-card--tinted' : '');

	it('falls back to critical for unknown/blank variants', () => {
		expect(safeVariant('minor')).toBe('minor');
		expect(safeVariant('MAJOR')).toBe('major');
		expect(safeVariant('')).toBe('critical');
		expect(safeVariant('bogus')).toBe('critical');
	});

	it('treats only true / "true" as tinted (UIB string-boolean safe)', () => {
		expect(toBool(true)).toBe(true);
		expect(toBool('true')).toBe(true);
		expect(toBool(false)).toBe(false);
		expect(toBool('false')).toBe(false);
	});

	it('builds the card class with variant and optional tint', () => {
		expect(cardClass('minor', false)).toBe('sc-card sc-card--minor');
		expect(cardClass('minor', true)).toBe('sc-card sc-card--minor sc-card--tinted');
	});
});
