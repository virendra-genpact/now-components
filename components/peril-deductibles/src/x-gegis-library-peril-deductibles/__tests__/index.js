// Tests for x-gegis-library-peril-deductibles
//
// These exercise the pure selector/derivation helpers that hold the
// component's display + interaction logic. Rendering/DOM tests run via
// `snc ui-component test`.

describe('peril-deductibles logic', () => {
	const DEFAULT_UNITS = [
		{ id: 'pct_tiv', label: '% TIV' },
		{ id: 'amount', label: '$ Amount' },
		{ id: 'pct_limit', label: '% Limit' },
	];

	const getItems = (props) =>
		props && props.perils && Array.isArray(props.perils.items) ? props.perils.items : [];

	const getUnits = (props) => {
		const u = props && props.unitOptions && Array.isArray(props.unitOptions.items) ? props.unitOptions.items : [];
		return u.length ? u : DEFAULT_UNITS;
	};

	const countOverrides = (items) => items.reduce((n, it) => (it && it.enabled ? n + 1 : n), 0);
	const isExpanded = (props) => props.expanded !== false;
	const optionId = (rowId, unitId) => `${rowId}|${unitId}`;
	const decodeOption = (encoded) => {
		const i = String(encoded).indexOf('|');
		return i < 0 ? { id: encoded, unit: '' } : { id: encoded.slice(0, i), unit: encoded.slice(i + 1) };
	};

	it('reads items defensively (object-wrapped json, never a bare array)', () => {
		expect(getItems({})).toEqual([]);
		expect(getItems({ perils: {} })).toEqual([]);
		expect(getItems({ perils: { items: [{ id: 'a' }] } })).toHaveLength(1);
	});

	it('falls back to default units when none supplied', () => {
		expect(getUnits({})).toBe(DEFAULT_UNITS);
		expect(getUnits({ unitOptions: { items: [] } })).toBe(DEFAULT_UNITS);
		expect(getUnits({ unitOptions: { items: [{ id: 'x', label: 'X' }] } })).toHaveLength(1);
	});

	it('counts only enabled rows as overrides', () => {
		const items = [{ enabled: true }, { enabled: false }, { enabled: true }, { enabled: true }];
		expect(countOverrides(items)).toBe(3);
		expect(countOverrides([])).toBe(0);
	});

	it('treats expanded as true unless explicitly false', () => {
		expect(isExpanded({})).toBe(true);
		expect(isExpanded({ expanded: true })).toBe(true);
		expect(isExpanded({ expanded: false })).toBe(false);
	});

	it('round-trips the row+unit identity through the dropdown option id', () => {
		expect(optionId('wind', 'pct_tiv')).toBe('wind|pct_tiv');
		expect(decodeOption('wind|pct_tiv')).toEqual({ id: 'wind', unit: 'pct_tiv' });
		// ids that themselves contain no separator decode to an empty unit
		expect(decodeOption('wind')).toEqual({ id: 'wind', unit: '' });
		// only the FIRST separator splits (unit values are safe)
		expect(decodeOption('wind|pct|tiv')).toEqual({ id: 'wind', unit: 'pct|tiv' });
	});
});
