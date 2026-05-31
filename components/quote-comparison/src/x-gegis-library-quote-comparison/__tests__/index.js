// Tests for x-gegis-library-quote-comparison
//
// Exercises the pure structure helpers (splitting header_summary vs body
// sections). Rendering/DOM tests run via `snc ui-component test`.

describe('quote-comparison section helpers', () => {
	const bodySectionsOf = (v) => ((v && v.sections) || []).filter((s) => s.type !== 'header_summary');
	const summaryOf = (v) => ((v && v.sections) || []).find((s) => s.type === 'header_summary') || null;

	const version = {
		sections: [
			{ sectionName: 'Policy Basics', type: 'header_summary', fields: [{ label: 'Authority Check' }] },
			{ sectionName: 'Policy Basics', type: 'section', fields: [{ label: 'State' }] },
			{ sectionName: 'TIV & Limits', type: 'section', fields: [{ label: 'Total TIV' }] },
		],
	};

	it('extracts the single header_summary section', () => {
		expect(summaryOf(version).sectionName).toBe('Policy Basics');
		expect(summaryOf(version).type).toBe('header_summary');
	});

	it('returns only the non-summary sections as body', () => {
		const body = bodySectionsOf(version);
		expect(body.length).toBe(2);
		expect(body.every((s) => s.type !== 'header_summary')).toBe(true);
	});

	it('is safe on missing / empty input', () => {
		expect(summaryOf(undefined)).toBe(null);
		expect(bodySectionsOf(undefined)).toEqual([]);
		expect(summaryOf({ sections: [] })).toBe(null);
	});
});
