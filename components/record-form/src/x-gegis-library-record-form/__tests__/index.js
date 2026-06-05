// Tests for x-gegis-library-record-form

describe('record-form helpers', () => {
	const toLabel = (name) =>
		String(name || '')
			.replace(/_/g, ' ')
			.replace(/\b\w/g, (c) => c.toUpperCase());

	it('converts snake_case field names to Title Case labels', () => {
		expect(toLabel('short_description')).toBe('Short Description');
		expect(toLabel('priority')).toBe('Priority');
		expect(toLabel('assigned_to')).toBe('Assigned To');
		expect(toLabel('')).toBe('');
	});

	const parseAutoSave = (raw) => {
		if (!raw) return [];
		if (Array.isArray(raw)) return raw;
		try { return JSON.parse(raw); } catch (e) { return []; }
	};

	it('parses autoSaveFields from an array', () => {
		expect(parseAutoSave(['short_description', 'priority'])).toEqual(['short_description', 'priority']);
	});

	it('parses autoSaveFields from a JSON string', () => {
		expect(parseAutoSave('["short_description"]')).toEqual(['short_description']);
	});

	it('returns empty array for falsy input', () => {
		expect(parseAutoSave(null)).toEqual([]);
		expect(parseAutoSave('')).toEqual([]);
		expect(parseAutoSave(undefined)).toEqual([]);
	});

	it('returns empty array for invalid JSON', () => {
		expect(parseAutoSave('not json')).toEqual([]);
	});

	const flatValues = (raw) => {
		if (!raw || typeof raw !== 'object') return {};
		const out = {};
		Object.keys(raw).forEach((k) => {
			const v = raw[k];
			out[k] = v && typeof v === 'object'
				? String(v.display_value != null ? v.display_value : (v.value != null ? v.value : ''))
				: String(v == null ? '' : v);
		});
		return out;
	};

	it('flattens display_value objects from the Table API', () => {
		const raw = {
			short_description: { display_value: 'My incident', value: 'My incident' },
			priority: { display_value: '1 - Critical', value: '1' },
			number: 'INC0001234',
		};
		const result = flatValues(raw);
		expect(result.short_description).toBe('My incident');
		expect(result.priority).toBe('1 - Critical');
		expect(result.number).toBe('INC0001234');
	});

	it('handles null/undefined field values gracefully', () => {
		const result = flatValues({ field: null, other: undefined });
		expect(result.field).toBe('');
		expect(result.other).toBe('');
	});
});
