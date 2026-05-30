// Tests for x-gegis-library-uw-guideline-score — tone/status resolution + escaping.

describe('uw-guideline-score helpers', () => {
	const RISK = {
		low: { num: '#1a7f4b' },
		medium: { num: '#9a6700' },
		high: { num: '#c8283c' },
	};
	const risk = (t) => RISK[t] || RISK.medium;
	const STATUS = { info: 'info', warning: 'warning', error: 'critical', success: 'positive' };
	const statusOf = (t) => STATUS[t] || 'warning';
	const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

	it('resolves risk tone (medium fallback)', () => {
		expect(risk('low').num).toBe('#1a7f4b');
		expect(risk('high').num).toBe('#c8283c');
		expect(risk('bogus')).toBe(RISK.medium);
	});

	it('maps status type to now-alert status', () => {
		expect(statusOf('error')).toBe('critical');
		expect(statusOf('success')).toBe('positive');
		expect(statusOf(undefined)).toBe('warning');
	});

	it('escapes the status message', () => {
		expect(esc('<b>x</b> & y')).toBe('&lt;b&gt;x&lt;/b&gt; &amp; y');
	});
});
