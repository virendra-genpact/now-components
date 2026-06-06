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
		if (t.includes('journal') || t.includes('html') || t.includes('translated') || t.includes('wiki')) return 'textarea';
		if (t.includes('glide list') || t.includes('glide_list') || t.includes('list')) return 'multi_reference';
		if (t.includes('reference') || t.includes('document id')) return 'reference';
		if (t.includes('integer') || t.includes('long') || t.includes('decimal') || t.includes('float') || t.includes('currency') || t.includes('price') || t.includes('percent') || t.includes('numeric'))
			return 'number';
		if (t.includes('date/time') || /\btime\b/.test(t)) return 'datetime';
		if (/\bdate\b/.test(t)) return 'date';
		if (t.includes('choice')) return 'choice';
		if (t.includes('password') || t.includes('encrypted')) return 'password';
		if (t.includes('url')) return 'url';
		if (t.includes('phone')) return 'phone';
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
		expect(normType('Document ID')).toBe('reference');
		expect(normType('Glide List')).toBe('multi_reference');
		expect(normType('List')).toBe('multi_reference');
		// Journal types are multi-line text — must NOT be mistaken for a list.
		expect(normType('Journal Input')).toBe('textarea');
		expect(normType('Journal List')).toBe('textarea');
		expect(normType('Journal')).toBe('textarea');
		expect(normType('Translated Text')).toBe('textarea');
		expect(normType('Wiki')).toBe('textarea');
		expect(normType('Price')).toBe('number');
		expect(normType('Integer')).toBe('number');
		expect(normType('Date/Time')).toBe('datetime');
		expect(normType('Date')).toBe('date');
		expect(normType('Due Date')).toBe('date');
		// "Validated" contains "date" — must NOT be a date field.
		expect(normType('IP Address (Validated IPV4, IPV6)')).toBe('string');
		expect(normType('Password (2 Way Encrypted)')).toBe('password');
		expect(normType('Encrypted Text')).toBe('password');
		expect(normType('URL')).toBe('url');
		expect(normType('Phone Number (E164)')).toBe('phone');
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

describe('dynamic-form UI Policy condition evaluator', () => {
	// Mirrors evalTerm/evalAndOr/evalConditions in ../index.js (kept inline so the
	// test has no platform/runtime deps).
	const evalTerm = (term, values) => {
		if (!term) return true;
		if (/^(ORDERBY|GROUPBY|RLQUERY|EQ)/.test(term)) return true;
		const m = term.match(
			/^([a-zA-Z0-9_.]+?)(ISNOTEMPTY|ISEMPTY|ANYTHING|STARTSWITH|ENDSWITH|NOT LIKE|LIKE|NOT IN|IN|>=|<=|!=|>|<|=)(.*)$/
		);
		if (!m) return false;
		const field = m[1]; const op = m[2]; const arg = m[3];
		const raw = values ? values[field] : undefined;
		const v = raw == null ? '' : String(raw);
		const lv = v.toLowerCase(); const la = String(arg).toLowerCase();
		const nv = Number(v); const na = Number(arg);
		const numeric = !isNaN(nv) && !isNaN(na);
		switch (op) {
			case 'ISEMPTY': return v === '';
			case 'ISNOTEMPTY': return v !== '';
			case 'ANYTHING': return true;
			case '=': return v === arg;
			case '!=': return v !== arg;
			case 'LIKE': return lv.indexOf(la) !== -1;
			case 'NOT LIKE': return lv.indexOf(la) === -1;
			case 'STARTSWITH': return lv.indexOf(la) === 0;
			case 'ENDSWITH': return lv.lastIndexOf(la) === lv.length - la.length && la.length <= lv.length;
			case 'IN': return arg.split(',').indexOf(v) !== -1;
			case 'NOT IN': return arg.split(',').indexOf(v) === -1;
			case '>': return numeric ? nv > na : v > arg;
			case '<': return numeric ? nv < na : v < arg;
			case '>=': return numeric ? nv >= na : v >= arg;
			case '<=': return numeric ? nv <= na : v <= arg;
			default: return false;
		}
	};
	const evalAndOr = (segment, values) => {
		const terms = String(segment).replace(/^\^+/, '').split('^').filter((t) => t !== '');
		if (!terms.length) return true;
		const clauses = [];
		terms.forEach((t) => {
			if (t.indexOf('OR') === 0 && clauses.length) clauses[clauses.length - 1].push(t.slice(2));
			else if (t.indexOf('OR') === 0) clauses.push([t.slice(2)]);
			else clauses.push([t]);
		});
		return clauses.every((cl) => cl.some((term) => evalTerm(term, values)));
	};
	const evalConditions = (conditions, values) => {
		const q = String(conditions || '').trim();
		if (!q) return true;
		return q.split('^NQ').some((seg) => evalAndOr(seg, values));
	};

	it('an empty condition always matches', () => {
		expect(evalConditions('', { state: '1' })).toBe(true);
	});

	it('evaluates the standard operators', () => {
		expect(evalConditions('state=1', { state: '1' })).toBe(true);
		expect(evalConditions('state!=1', { state: '2' })).toBe(true);
		expect(evalConditions('assigned_toISEMPTY', { assigned_to: '' })).toBe(true);
		expect(evalConditions('assigned_toISNOTEMPTY', { assigned_to: 'x' })).toBe(true);
		expect(evalConditions('numberSTARTSWITHINC', { number: 'INC0001' })).toBe(true);
		expect(evalConditions('numberENDSWITH001', { number: 'INC0001' })).toBe(true);
		expect(evalConditions('priorityIN1,2,3', { priority: '2' })).toBe(true);
		expect(evalConditions('priorityIN1,2,3', { priority: '4' })).toBe(false);
		expect(evalConditions('priority>=3', { priority: '3' })).toBe(true);
	});

	it('AND-s clauses and OR-s within a clause: a AND (b OR c)', () => {
		const q = 'active=true^state=1^ORstate=2';
		expect(evalConditions(q, { active: 'true', state: '2' })).toBe(true);
		expect(evalConditions(q, { active: 'true', state: '3' })).toBe(false);
		expect(evalConditions(q, { active: 'false', state: '2' })).toBe(false);
	});

	it('treats ^NQ as a separate OR-ed query', () => {
		const q = 'state=1^NQpriority=1';
		expect(evalConditions(q, { state: '1', priority: '5' })).toBe(true);
		expect(evalConditions(q, { state: '9', priority: '1' })).toBe(true);
		expect(evalConditions(q, { state: '9', priority: '5' })).toBe(false);
	});

	it('handles dot-walked condition fields and missing values', () => {
		expect(evalConditions('caller_id.vip=true', { 'caller_id.vip': 'true' })).toBe(true);
		expect(evalConditions('stateISEMPTY', {})).toBe(true);
	});
});

describe('dynamic-form UI Policy action folding', () => {
	const triState = (v) => {
		const s = String(v);
		if (s === 'true') return true;
		if (s === 'false') return false;
		return null;
	};

	it('parses tri-state action values', () => {
		expect(triState('true')).toBe(true);
		expect(triState('false')).toBe(false);
		expect(triState('ignore')).toBe(null);
		expect(triState(undefined)).toBe(null);
	});
});

describe('dynamic-form reference picker', () => {
	// The typeahead item id encodes the field ("field::sysId") so a selection maps
	// back to the right field even when the payload omits `name` (the save bug).
	const decode = (rawValue, fallbackName) => {
		const raw = String(rawValue == null ? '' : rawValue);
		const i = raw.indexOf('::');
		return {
			field: i >= 0 ? raw.slice(0, i) : fallbackName,
			sysId: i >= 0 ? raw.slice(i + 2) : raw,
		};
	};

	it('round-trips field + sys_id through the encoded item id', () => {
		const sysId = '6816f79cc0a8016401c5a33be04be441';
		const id = `assigned_to::${sysId}`;
		expect(decode(id)).toEqual({ field: 'assigned_to', sysId });
	});

	it('falls back to the payload name when the id is not encoded', () => {
		expect(decode('justsysid', 'caller_id')).toEqual({ field: 'caller_id', sysId: 'justsysid' });
	});

	it('treats a null selection (deselect) as an empty value', () => {
		expect(decode(null, 'caller_id')).toEqual({ field: 'caller_id', sysId: '' });
	});
});

describe('dynamic-form inherited choices fallback', () => {
	// Inherited choice fields (e.g. state on task) store choices under the ANCESTOR
	// table, but resolveField returns the base table — so look up through the family.
	const choices = { 'task.state': [{ label: 'New', value: '1' }] };
	const family = ['incident', 'task'];
	const choicesFor = (table, col, dotwalk) => {
		const direct = table ? choices[`${table}.${col}`] : null;
		if (direct && direct.length) return direct;
		if (dotwalk) return null;
		for (let i = 0; i < family.length; i++) {
			const c = choices[`${family[i]}.${col}`];
			if (c && c.length) return c;
		}
		return null;
	};

	it('finds an inherited choice list under a parent table', () => {
		expect(choicesFor('incident', 'state', false)).toEqual(choices['task.state']);
	});

	it('does not apply the family fallback to dot-walked fields', () => {
		expect(choicesFor('incident', 'state', true)).toBe(null);
	});
});

describe('dynamic-form long-string -> textarea', () => {
	// A plain String field with a large max_length renders as a multi-line textarea,
	// matching the platform form (e.g. an `address` String(400)).
	const LONG_STRING_LEN = 255;
	const resolveType = (type, maxLength) =>
		(type === 'string' && maxLength > LONG_STRING_LEN) ? 'textarea' : type;

	it('promotes a long string to textarea', () => {
		expect(resolveType('string', 400)).toBe('textarea');
		expect(resolveType('string', 256)).toBe('textarea');
	});

	it('keeps short/normal strings as single-line inputs', () => {
		expect(resolveType('string', 40)).toBe('string');
		expect(resolveType('string', 255)).toBe('string');
		expect(resolveType('string', 0)).toBe('string');
	});

	it('does not affect non-string types', () => {
		expect(resolveType('reference', 400)).toBe('reference');
		expect(resolveType('choice', 400)).toBe('choice');
	});
});

describe('dynamic-form multi-reference (Glide List) pills', () => {
	// Seed: a CSV of sys_ids (value) + CSV of labels (display) -> pill objects with
	// field-encoded ids. Selection: encoded ids -> CSV of sys_ids saved back.
	const seed = (field, idCsv, lblCsv) => {
		const ids = !idCsv ? [] : String(idCsv).split(',').map((s) => s.trim()).filter(Boolean);
		const lbls = !lblCsv ? [] : String(lblCsv).split(',').map((s) => s.trim());
		return ids.map((sid, i) => ({ id: `${field}::${sid}`, label: lbls[i] || sid }));
	};
	const toCsv = (encodedIds) => encodedIds.map((raw) => {
		const r = String(raw); const i = r.indexOf('::');
		return i >= 0 ? r.slice(i + 2) : r;
	}).join(',');

	it('seeds pills from the CSV value + display', () => {
		expect(seed('watch_list', 'aaa,bbb', 'Jane Doe,Bob Lee')).toEqual([
			{ id: 'watch_list::aaa', label: 'Jane Doe' },
			{ id: 'watch_list::bbb', label: 'Bob Lee' },
		]);
	});

	it('handles an empty multi value', () => {
		expect(seed('watch_list', '', '')).toEqual([]);
	});

	it('saves the selection back as a CSV of sys_ids', () => {
		expect(toCsv(['watch_list::aaa', 'watch_list::bbb'])).toBe('aaa,bbb');
		expect(toCsv([])).toBe('');
	});
});
