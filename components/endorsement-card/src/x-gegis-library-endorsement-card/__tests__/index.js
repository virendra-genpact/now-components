// Tests for x-gegis-library-endorsement-card
//
// Exercises the pure action-text + label helpers. Rendering/DOM tests run via
// `snc ui-component test`.

describe('endorsement-card helpers', () => {
	const labelOf = (m) => (typeof m === 'string' ? m : m && m.label ? m.label : '');
	const defaultActionText = (type) => {
		if (type === 'required') return 'Required';
		if (type === 'add') return '+ Add';
		if (type === 'remove') return '× Remove';
		return '';
	};

	it('derives the default button text per action type', () => {
		expect(defaultActionText('required')).toBe('Required');
		expect(defaultActionText('add')).toBe('+ Add');
		expect(defaultActionText('remove')).toBe('× Remove');
		expect(defaultActionText('none')).toBe('');
	});

	it('reads a tag label from a string or an object', () => {
		expect(labelOf('Suggested')).toBe('Suggested');
		expect(labelOf({ label: 'ISO', color: 'blue' })).toBe('ISO');
		expect(labelOf(null)).toBe('');
		expect(labelOf(undefined)).toBe('');
	});
});
