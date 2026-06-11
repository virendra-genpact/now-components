// Tests for x-gegis-library-mcope-score-card — pure bullet-parsing + variant logic.

describe('mcope-score-card logic', () => {
	const VARIANTS = ['low', 'medium', 'high'];
	const BULLET_PREFIX_RE = /^[\-\*•·]\s*/;
	const safeVariant = (v) => (VARIANTS.includes(v) ? v : 'medium');

	function parseBullets(raw, delimiter) {
		if (Array.isArray(raw)) {
			if (typeof raw[0] === 'object' && raw[0] !== null) return raw.map((i) => i.text || '').filter(Boolean);
			return raw.filter(Boolean);
		}
		if (typeof raw === 'string') {
			const trimmed = raw.trim();
			if (!trimmed) return [];
			if (trimmed.startsWith('[')) {
				try {
					const parsed = JSON.parse(trimmed);
					if (Array.isArray(parsed)) return parseBullets(parsed, delimiter);
				} catch (_) { /* fall through */ }
			}
			const normalized = trimmed.replace(/\\n/g, '\n');
			const sep = delimiter === 'comma' ? ',' : '\n';
			return normalized.split(sep).map((s) => s.replace(BULLET_PREFIX_RE, '').trim()).filter(Boolean);
		}
		return [];
	}

	it('falls back to medium for unknown variants', () => {
		expect(safeVariant('high')).toBe('high');
		expect(safeVariant('bogus')).toBe('medium');
	});

	it('splits newline text and strips bullet prefixes', () => {
		expect(parseBullets('- one\n* two\n· three', 'newline')).toEqual(['one', 'two', 'three']);
	});

	it('splits comma text when delimiter is comma', () => {
		expect(parseBullets('a, b, c', 'comma')).toEqual(['a', 'b', 'c']);
	});

	it('parses a JSON array of strings or {text} objects', () => {
		expect(parseBullets('["x","y"]', 'newline')).toEqual(['x', 'y']);
		expect(parseBullets([{ text: 'p' }, { text: '' }], 'newline')).toEqual(['p']);
	});

	it('normalises literal \\n sequences from the DB', () => {
		expect(parseBullets('one\\ntwo', 'newline')).toEqual(['one', 'two']);
	});
});
