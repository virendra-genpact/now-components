// Tests for x-gegis-library-extraction-summary
//
// Exercises the pure selection logic (which version the card shows for a given
// selectedId). Rendering/DOM tests run via `snc ui-component test`.

describe('extraction-summary version selection', () => {
	// Mirrors the view: selected = find(id) || first || null
	const resolveSelected = (list, selectedId) =>
		(Array.isArray(list) ? list : []).find((v) => String(v.id) === String(selectedId)) ||
		(Array.isArray(list) ? list : [])[0] ||
		null;

	const list = [{ id: 'v3' }, { id: 'v2' }, { id: 'v1' }];

	it('selects the item matching selectedId', () => {
		expect(resolveSelected(list, 'v2').id).toBe('v2');
	});

	it('falls back to the first item when selectedId is empty or unknown', () => {
		expect(resolveSelected(list, '').id).toBe('v3');
		expect(resolveSelected(list, 'nope').id).toBe('v3');
	});

	it('handles missing / non-array input safely', () => {
		expect(resolveSelected(undefined, 'v1')).toBe(null);
		expect(resolveSelected([], 'v1')).toBe(null);
	});

	it('matches numeric ids passed as numbers or strings', () => {
		const numbered = [{ id: 1 }, { id: 2 }];
		expect(resolveSelected(numbered, '2').id).toBe(2);
		expect(resolveSelected(numbered, 2).id).toBe(2);
	});
});
