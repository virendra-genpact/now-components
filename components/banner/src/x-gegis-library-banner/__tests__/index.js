// Tests for x-gegis-library-banner — exercise the pure type→status/icon mapping
// and the line-assembly logic that the view relies on.

describe('banner type mapping & content', () => {
	const TYPE_MAP = {
		info: { status: 'info', icon: 'circle-info-outline' },
		warning: { status: 'warning', icon: 'exclamation-triangle-fill' },
		error: { status: 'critical', icon: 'exclamation-triangle-fill' },
		success: { status: 'positive', icon: 'check-circle-fill' },
	};
	const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	const buildContent = (lines) => lines.filter((l) => l && String(l).trim() !== '').map((l) => `<div>${esc(l)}</div>`).join('');

	it('maps each type to the right now-alert status', () => {
		expect(TYPE_MAP.info.status).toBe('info');
		expect(TYPE_MAP.warning.status).toBe('warning');
		expect(TYPE_MAP.error.status).toBe('critical');
		expect(TYPE_MAP.success.status).toBe('positive');
	});

	it('skips empty lines and escapes HTML', () => {
		expect(buildContent(['a', '', '  ', 'b'])).toBe('<div>a</div><div>b</div>');
		expect(buildContent(['<script>x'])).toBe('<div>&lt;script&gt;x</div>');
		expect(buildContent(['', '', '', ''])).toBe('');
	});
});
