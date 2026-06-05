// Tests for x-gegis-library-quote-action-bar
//
// Pure selection logic the view relies on. Rendering/DOM tests run via
// `snc ui-component test`.

describe('quote-action-bar logic', () => {
	const getOptions = (props) =>
		props && props.options && Array.isArray(props.options.items) ? props.options.items : [];
	const getSelected = (state, props) => {
		if (Array.isArray(state.selected)) return state.selected;
		return props && props.selectedIds && Array.isArray(props.selectedIds.ids) ? props.selectedIds.ids : [];
	};
	const allIds = (opts) => opts.map((o) => o.id);
	const isAllSelected = (selected, opts) => opts.length > 0 && selected.length >= opts.length;

	const props = { options: { items: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }] } };

	it('reads options + selection defensively (object-wrapped json)', () => {
		expect(getOptions({})).toEqual([]);
		expect(getOptions(props)).toHaveLength(4);
		expect(getSelected({}, {})).toEqual([]);
		expect(getSelected({}, { selectedIds: { ids: ['a'] } })).toEqual(['a']);
		expect(getSelected({ selected: ['b'] }, { selectedIds: { ids: ['a'] } })).toEqual(['b']); // state wins
	});

	it('select-all toggles between all ids and empty', () => {
		const opts = getOptions(props);
		const empty = [];
		const next1 = isAllSelected(empty, opts) ? [] : allIds(opts);
		expect(next1).toEqual(['a', 'b', 'c', 'd']);
		const next2 = isAllSelected(next1, opts) ? [] : allIds(opts);
		expect(next2).toEqual([]);
	});

	it('approve/share are enabled only when 1+ selected', () => {
		const enabled = (selected) => selected.length > 0;
		expect(enabled([])).toBe(false);
		expect(enabled(['a'])).toBe(true);
		expect(enabled(['a', 'b'])).toBe(true);
	});

	it('reports the count as selected length out of total', () => {
		const opts = getOptions(props);
		const selected = ['a', 'c'];
		expect(`${selected.length} of ${opts.length} selected`).toBe('2 of 4 selected');
	});
});
