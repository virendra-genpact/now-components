// Tests for x-gegis-library-dynamic-form
//
// Exercises the pure value-resolution + save-collection logic. Rendering/DOM
// tests run via `snc ui-component test`.

describe('dynamic-form value logic', () => {
	const fieldName = (f) => f.name || f.label || '';
	const valueFor = (values, f) => {
		const nm = fieldName(f);
		if (values && Object.prototype.hasOwnProperty.call(values, nm)) return values[nm];
		return f.value != null ? f.value : '';
	};
	const collect = (sections, values) => {
		const full = {};
		(sections || []).forEach((s) => (s.fields || []).forEach((f) => {
			full[fieldName(f)] = valueFor(values, f);
		}));
		return full;
	};

	const sections = [
		{ sectionName: 'A', fields: [{ label: 'City', name: 'city', value: 'LA' }, { label: 'ZIP', name: 'zip' }] },
	];

	it('prefers an edited value over the field default', () => {
		expect(valueFor({ city: 'NY' }, sections[0].fields[0])).toBe('NY');
	});

	it('falls back to the field default, then empty string', () => {
		expect(valueFor({}, sections[0].fields[0])).toBe('LA');
		expect(valueFor({}, sections[0].fields[1])).toBe('');
	});

	it('collects all field values for save, keyed by name', () => {
		expect(collect(sections, { zip: '90001' })).toEqual({ city: 'LA', zip: '90001' });
	});

	it('uses label as the key when name is missing', () => {
		expect(fieldName({ label: 'State' })).toBe('State');
	});
});
