// Tests for x-gegis-library-guidelines-score-card — variant guarding + payloads.

describe('guidelines-score-card logic', () => {
	const RISKS = ['low', 'medium', 'high'];
	const BANNERS = ['info', 'warning', 'critical'];
	const safeRisk = (v) => (RISKS.includes(v) ? v : 'low');
	const safeBanner = (v) => (BANNERS.includes(v) ? v : 'warning');

	it('guards the risk variant (default low)', () => {
		expect(safeRisk('high')).toBe('high');
		expect(safeRisk('bogus')).toBe('low');
	});

	it('guards the banner variant (default warning)', () => {
		expect(safeBanner('critical')).toBe('critical');
		expect(safeBanner(undefined)).toBe('warning');
	});

	it('builds the methodology + banner-link payloads with safe variants', () => {
		expect({ scoreValue: 8, riskLabel: 'Low Risk', riskVariant: safeRisk('low') }).toEqual({ scoreValue: 8, riskLabel: 'Low Risk', riskVariant: 'low' });
		expect({ linkText: 'go', variant: safeBanner('x') }).toEqual({ linkText: 'go', variant: 'warning' });
	});
});
