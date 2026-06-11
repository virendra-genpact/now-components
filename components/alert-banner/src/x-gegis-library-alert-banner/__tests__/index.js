// Tests for x-gegis-library-alert-banner — variant guarding + link payload.

describe('alert-banner logic', () => {
	const VARIANTS = ['info', 'warning', 'critical', 'ai'];
	const safeVariant = (v) => (VARIANTS.includes(v) ? v : 'info');
	const linkPayload = (linkText, variant) => ({ linkText, variant: safeVariant(variant) });

	it('falls back to info for unknown variants', () => {
		expect(safeVariant('warning')).toBe('warning');
		expect(safeVariant('ai')).toBe('ai');
		expect(safeVariant('bogus')).toBe('info');
		expect(safeVariant(undefined)).toBe('info');
	});

	it('builds the link payload with the safe variant', () => {
		expect(linkPayload('Pick a record', 'critical')).toEqual({ linkText: 'Pick a record', variant: 'critical' });
		expect(linkPayload('x', 'nope')).toEqual({ linkText: 'x', variant: 'info' });
	});
});
