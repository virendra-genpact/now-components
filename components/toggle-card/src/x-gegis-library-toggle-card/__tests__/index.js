// Tests for x-gegis-library-toggle-card
//
// Exercises the pure toggle logic (flip one item's `on`, leave others).
// Rendering/DOM tests run via `snc ui-component test`.

describe('toggle-card toggle logic', () => {
	const toggleAt = (list, i) =>
		(Array.isArray(list) ? list : []).map((it, idx) => (idx === i ? { ...it, on: !it.on } : it));

	const items = [
		{ label: 'Building', on: true },
		{ label: 'BPP', on: false },
		{ label: 'PPOuilding', on: true },
	];

	it('flips only the targeted row', () => {
		const next = toggleAt(items, 1);
		expect(next[1].on).toBe(true);
		expect(next[0].on).toBe(true);
		expect(next[2].on).toBe(true);
	});

	it('does not mutate the original array/items', () => {
		const next = toggleAt(items, 0);
		expect(next[0].on).toBe(false);
		expect(items[0].on).toBe(true); // original unchanged
		expect(next).not.toBe(items);
	});

	it('is safe on empty / non-array input', () => {
		expect(toggleAt(undefined, 0)).toEqual([]);
		expect(toggleAt([], 0)).toEqual([]);
	});
});
