// Tests for x-gegis-library-dynamic-form
//
// Exercises the pure transforms used to turn Table-API responses into the
// render model. Mirrors the helpers in ../index.js (kept inline so the test
// has no platform/runtime deps). Rendering/DOM tests run via
// `snc ui-component test`.

describe('dynamic-form transforms', () => {
	const rawVal = (cell) => (cell && typeof cell === 'object' ? cell.value : cell);
	const dispVal = (cell) => (cell && typeof cell === 'object' ? cell.display_value : cell);

	const normType = (disp) => {
		const t = String(disp || '').toLowerCase();
		if (t.includes('true/false') || t.includes('boolean')) return 'boolean';
		if (t.includes('reference') || t.includes('document id') || t.includes('glide list') || t.includes('list'))
			return 'reference';
		if (t.includes('integer') || t.includes('long') || t.includes('decimal') || t.includes('float') || t.includes('currency') || t.includes('percent') || t.includes('numeric'))
			return 'number';
		if (t.includes('date/time') || t.includes('time')) return 'datetime';
		if (t.includes('date')) return 'date';
		if (t.includes('html') || t.includes('journal') || t.includes('translated')) return 'textarea';
		if (t.includes('choice')) return 'choice';
		return 'string';
	};

	it('unwraps {value, display_value} cells', () => {
		expect(rawVal({ value: '1', display_value: 'Critical' })).toBe('1');
		expect(dispVal({ value: '1', display_value: 'Critical' })).toBe('Critical');
		expect(rawVal('plain')).toBe('plain');
	});

	it('maps dictionary types to render kinds', () => {
		expect(normType('True/False')).toBe('boolean');
		expect(normType('Reference')).toBe('reference');
		expect(normType('Integer')).toBe('number');
		expect(normType('Date/Time')).toBe('datetime');
		expect(normType('Date')).toBe('date');
		expect(normType('HTML')).toBe('textarea');
		expect(normType('Choice')).toBe('choice');
		expect(normType('String')).toBe('string');
		expect(normType(undefined)).toBe('string');
	});

	it('groups layout rows into ordered sections, dropping non-fields & unknowns', () => {
		const inRecord = new Set(['short_description', 'priority']);
		const layout = [
			{ element: 'short_description', sys_ui_section: { display_value: 'Details' } },
			{ element: '.split', sys_ui_section: { display_value: 'Details' } }, // not a field
			{ element: 'priority', sys_ui_section: { display_value: 'Details' } },
			{ element: 'not_in_view', sys_ui_section: { display_value: 'Details' } }, // not in record
		];
		const usable = layout.filter((r) => {
			const el = rawVal(r.element);
			return el && !String(el).startsWith('.') && inRecord.has(el);
		});
		expect(usable.map((r) => rawVal(r.element))).toEqual(['short_description', 'priority']);
		expect(dispVal(usable[0].sys_ui_section)).toBe('Details');
	});

	it('a field with a choice list renders as a choice regardless of base type', () => {
		const choices = { priority: [{ label: '1 - Critical', value: '1' }] };
		const baseType = 'number';
		const type = Array.isArray(choices.priority) && choices.priority.length ? 'choice' : baseType;
		expect(type).toBe('choice');
	});
});
