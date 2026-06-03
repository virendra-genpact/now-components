import { createCustomElement } from '@servicenow/ui-core';
import snabbdom from '@servicenow/ui-renderer-snabbdom';
import styles from './styles.scss';

/* ================================================================== *
 * x-gegis-library-record-form  — production grade
 *
 * Data sources:
 *   sys_ui_view          → resolve view (internal name + sys_id)
 *   sys_ui_form/section/element → layout + ordering
 *   sys_dictionary       → label, internal_type, mandatory, read_only
 *   sys_choice           → choice values for dropdown fields
 *   sys_ui_policy + _action → dynamic mandatory/readOnly/visible rules
 *   sys_ui_action        → form buttons (condition-evaluated, positioned)
 *
 * Field rendering by internal_type:
 *   boolean   → now-toggle
 *   choice    → now-dropdown  (fieldName·value encoded items)
 *   reference → now-input readonly (display value)
 *   all else  → now-input  (type mapped from internal_type)
 *
 * Properties:
 *   formTitle          → heading shown above the form
 *   actionBarPosition  → top | bottom | both
 *   saveLabel          → Save button label
 *   readonly           → lock all fields, hide Save
 *   autoSaveFields     → PATCH specific fields immediately on blur
 * ================================================================== */

/* ── Parse helpers ───────────────────────────────────────────── */

const toLabel = (name) =>
	String(name || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const parseJson = (raw, fallback) => {
	if (!raw) return fallback;
	if (typeof raw === 'object') return raw;
	try { return JSON.parse(raw); } catch (e) { return fallback; }
};

const parseAutoSave = (raw) => {
	const arr = parseJson(raw, []);
	return Array.isArray(arr) ? arr : [];
};

/* ── Field-type helpers ──────────────────────────────────────── */

const INPUT_TYPE_MAP = {
	integer: 'number', float: 'number', decimal: 'number', currency: 'number',
	email: 'email', url: 'url', phone_number: 'tel',
	glide_date: 'date', due_date: 'date',
	glide_date_time: 'datetime-local', glide_time: 'time',
};
const inputTypeFor = (ft) => INPUT_TYPE_MAP[ft] || 'text';

const isBool = (ft) => ft === 'boolean';
const isChoice = (ft) => ft === 'choice';
const isRef = (ft) => ft === 'reference' || ft === 'domain_id' || ft === 'glide_list' || ft === 'document_id';

/* Middle-dot separator (·) for encoding fieldName + choice value in dropdown item id */
const SEP = '·';
const encodeChoice = (fieldName, value) => `${fieldName}${SEP}${value}`;
const decodeChoice = (encoded) => {
	const i = String(encoded).indexOf(SEP);
	return i < 0 ? { name: '', value: encoded } : { name: encoded.slice(0, i), value: encoded.slice(i + 1) };
};

/* True for ServiceNow boolean field values ("true"/"1"/true) */
const isTruthy = (v) => v === true || v === 'true' || v === '1';

/* ── Fetch helpers ───────────────────────────────────────────── */

const refVal = (v) => (v && typeof v === 'object' ? v.value : v) || '';

const snFetch = (url) =>
	fetch(url, { headers: { Accept: 'application/json' }, credentials: 'same-origin' })
		.then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status} — ${url}`); return r.json(); });

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

const patchRecord = (table, sysId, payload) =>
	fetch(`/api/now/table/${encodeURIComponent(table)}/${encodeURIComponent(sysId)}`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
		credentials: 'same-origin',
		body: JSON.stringify(payload),
	}).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); });

/* ── Condition evaluation (shared: UI Policies + UI Actions) ── *
 *
 * ServiceNow encoded query syntax:
 *   =  !=  >  <  >=  <=  CONTAINS  STARTSWITH  IN  ISEMPTY  ISNOTEMPTY
 *   ^  = AND    ^OR = OR
 * ─────────────────────────────────────────────────────────────── */

const evaluatePart = (part, values) => {
	const m = part.match(/^(\w+)(>=|<=|!=|>|<|ISNOTEMPTY|ISEMPTY|STARTSWITH|CONTAINS|IN|=)(.*)$/);
	if (!m) return true;
	const [, field, op, condVal] = m;
	const fv = String(values[field] == null ? '' : values[field]);
	switch (op) {
		case '=':          return fv === condVal;
		case '!=':         return fv !== condVal;
		case '>':          return Number(fv) > Number(condVal);
		case '<':          return Number(fv) < Number(condVal);
		case '>=':         return Number(fv) >= Number(condVal);
		case '<=':         return Number(fv) <= Number(condVal);
		case 'CONTAINS':   return fv.toLowerCase().includes(condVal.toLowerCase());
		case 'STARTSWITH': return fv.toLowerCase().startsWith(condVal.toLowerCase());
		case 'IN':         return condVal.split(',').map((s) => s.trim()).includes(fv);
		case 'ISEMPTY':    return fv === '' || fv === '0' || fv === 'false';
		case 'ISNOTEMPTY': return fv !== '' && fv !== '0' && fv !== 'false';
		default:           return true;
	}
};

const evaluateConditions = (condStr, values) => {
	if (!condStr) return true;
	return condStr.split('^OR').some((group) =>
		group.split('^').filter(Boolean).every((part) => evaluatePart(part, values))
	);
};

/* UI Action conditions may be JavaScript expressions — skip evaluation
 * and always show those buttons (we cannot safely run arbitrary JS). */
const evaluateActionCondition = (condition, values) => {
	if (!condition) return true;
	if (/^javascript:/i.test(condition.trim())) return true;
	return evaluateConditions(condition, values);
};

/* ── UI Policy application ───────────────────────────────────── */

const applyPolicies = (policies, values) => {
	const overrides = {};
	(policies || []).forEach((policy) => {
		const condMet = evaluateConditions(policy.conditions, values);
		policy.actions.forEach((action) => {
			if (!action.field) return;
			if (!overrides[action.field]) overrides[action.field] = { mandatory: null, readOnly: null, visible: null };
			const o = overrides[action.field];
			const resolve = (av) => {
				if (av === '' || av == null) return null;
				const base = isTruthy(av);
				if (condMet) return base;
				return policy.reverseOnFalse ? !base : null;
			};
			const m = resolve(action.mandatory);
			const r = resolve(action.readOnly);
			const v = resolve(action.visible);
			if (m !== null) o.mandatory = m;
			if (r !== null) o.readOnly = r;
			if (v !== null) o.visible = v;
		});
	});
	return overrides;
};

/* ── Debounce timer ──────────────────────────────────────────── */
let _loadTimer = null;

/* ── Data load: layout + record + policies + UI actions ─────── *
 *
 * Schema facts (from FormLayoutHelper GlideRecord — ground truth):
 *   sys_ui_view.name       = internal name ('' for Default view)
 *   sys_ui_view.title      = human title ('Default view', 'ITIL'…)
 *   sys_ui_form.view       = sys_ui_view.name  (internal name)
 *   sys_ui_section.view    = sys_ui_view.sys_id
 *   sys_ui_element.sys_ui_section = sys_ui_section.sys_id
 *   sys_ui_element.position = string → sort numerically
 *   Elements starting with '.' (.split, .begin_split…) = skip
 *   sys_dictionary: query WITHOUT sysparm_display_value so
 *     internal_type returns 'boolean'/'choice' not display labels
 *   sys_ui_action.form_button = boolean → show in action bar
 *   sys_ui_action.condition   = encoded query or 'javascript:…'
 * ─────────────────────────────────────────────────────────────── */
const loadFormAndRecord = (table, sysId, formView) => {
	const enc = encodeURIComponent;

	/* ① Record values — fully independent, starts immediately */
	const recordPromise = snFetch(
		`/api/now/table/${enc(table)}/${enc(sysId)}?sysparm_display_value=true`
	);

	/* ② Resolve view → needed by all other layout/policy/action fetches */
	const viewPromise = snFetch(
		`/api/now/table/sys_ui_view` +
		`?sysparm_query=title=${enc(formView)}^ORname=${enc(formView)}` +
		`&sysparm_fields=sys_id,name,title&sysparm_limit=5`
	).then((r) => {
		const v = r.result && r.result[0];
		if (!v) throw new Error(`View "${formView}" not found. Check the title in sys_ui_view.list.`);
		return { internalName: v.name || '', viewSysId: v.sys_id };
	});

	/* ③ UI Policies — parallel after view resolves */
	const policiesPromise = viewPromise.then(({ internalName }) =>
		snFetch(
			`/api/now/table/sys_ui_policy` +
			`?sysparm_query=name=${enc(table)}^active=true` +
			`&sysparm_fields=sys_id,conditions,reverse_fields_on_false,order,view` +
			`&sysparm_orderby=order&sysparm_limit=100`
		).then((pRes) => {
			const pList = (pRes.result || []).filter(
				(p) => !p.view || p.view === '' || p.view === internalName
			);
			if (!pList.length) return [];
			const pIds = pList.map((p) => p.sys_id).join(',');
			return snFetch(
				`/api/now/table/sys_ui_policy_action` +
				`?sysparm_query=ui_policyIN${pIds}` +
				`&sysparm_fields=ui_policy,field,mandatory,visible,read_only&sysparm_limit=500`
			).then((aRes) => {
				const byPolicy = {};
				(aRes.result || []).forEach((a) => {
					const pid = refVal(a.ui_policy);
					if (!byPolicy[pid]) byPolicy[pid] = [];
					byPolicy[pid].push({ field: a.field, mandatory: a.mandatory, readOnly: a.read_only, visible: a.visible });
				});
				return pList.map((p) => ({
					sys_id: p.sys_id,
					conditions: p.conditions || '',
					reverseOnFalse: isTruthy(p.reverse_fields_on_false),
					actions: byPolicy[p.sys_id] || [],
				}));
			});
		}).catch(() => [])
	).catch(() => []);

	/* ④ UI Actions — parallel after view resolves
	 *   Fetch active form buttons/links for the table.
	 *   Conditions are evaluated in the view (dynamic on every value change). */
	const uiActionsPromise = viewPromise.then(({ internalName }) =>
		snFetch(
			`/api/now/table/sys_ui_action` +
			`?sysparm_query=name=${enc(table)}^active=true` +
			`&sysparm_fields=sys_id,name,action_name,condition,hint,client,order,form_button,form_link,view` +
			`&sysparm_orderby=order&sysparm_limit=50`
		).then((r) => (r.result || []).filter((a) =>
			(isTruthy(a.form_button) || isTruthy(a.form_link)) &&
			/* Include actions for this view or all views (empty view field) */
			(!a.view || a.view === '' || a.view === internalName)
		))
		.catch(() => [])
	).catch(() => []);

	/* ⑤ Sections + elements + dictionary + choices chain */
	const sectionsPromise = viewPromise.then(({ internalName, viewSysId }) =>
		snFetch(
			`/api/now/table/sys_ui_form` +
			`?sysparm_query=name=${enc(table)}^view=${enc(internalName)}` +
			`&sysparm_fields=sys_id&sysparm_limit=1`
		).then((formRes) => {
			const form = formRes.result && formRes.result[0];
			if (form) {
				return snFetch(
					`/api/now/table/sys_ui_form_section` +
					`?sysparm_query=sys_ui_form=${enc(form.sys_id)}` +
					`&sysparm_fields=sys_ui_section,position&sysparm_orderby=position&sysparm_limit=50`
				).then((fsRes) => {
					const orderedIds = (fsRes.result || []).map((fs) => refVal(fs.sys_ui_section)).filter(Boolean);
					if (!orderedIds.length) return { sectionList: [], orderedIds: [] };
					return snFetch(
						`/api/now/table/sys_ui_section` +
						`?sysparm_query=sys_idIN${orderedIds.join(',')}` +
						`&sysparm_fields=sys_id,caption,columns&sysparm_limit=50`
					).then((secRes) => {
						const byId = {};
						(secRes.result || []).forEach((s) => { byId[s.sys_id] = s; });
						return { sectionList: orderedIds.map((id) => byId[id]).filter(Boolean), orderedIds };
					});
				});
			}
			return snFetch(
				`/api/now/table/sys_ui_section` +
				`?sysparm_query=name=${enc(table)}^view=${enc(viewSysId)}` +
				`&sysparm_fields=sys_id,caption,position,columns` +
				`&sysparm_orderby=position^sys_id&sysparm_limit=50`
			).then((secRes) => {
				const sectionList = secRes.result || [];
				return { sectionList, orderedIds: sectionList.map((s) => s.sys_id) };
			});
		})
		.then(({ sectionList, orderedIds }) => {
			if (!orderedIds.length) return { sectionList: [], elementList: [], dictMap: {}, choicesMap: {} };
			return snFetch(
				`/api/now/table/sys_ui_element` +
				`?sysparm_query=sys_ui_sectionIN${orderedIds.join(',')}` +
				`&sysparm_fields=element,type,position,sys_ui_section` +
				`&sysparm_orderby=position&sysparm_limit=500`
			).then((elRes) => {
				const elementList = (elRes.result || [])
					.filter((el) => el.element && !el.element.startsWith('.'))
					.sort((a, b) => parseInt(a.position, 10) - parseInt(b.position, 10));
				const fieldNames = [...new Set(elementList.map((el) => el.element))];
				if (!fieldNames.length) return { sectionList, elementList, dictMap: {}, choicesMap: {} };
				/* No sysparm_display_value: internal_type must stay raw ('boolean', 'choice'…) */
				return snFetch(
					`/api/now/table/sys_dictionary` +
					`?sysparm_query=name=${enc(table)}^elementIN${fieldNames.join(',')}` +
					`&sysparm_fields=element,column_label,internal_type,mandatory,read_only&sysparm_limit=500`
				).then((dictRes) => {
					const dictMap = {};
					(dictRes.result || []).forEach((d) => {
						dictMap[d.element] = {
							label: d.column_label || toLabel(d.element),
							type: d.internal_type || 'string',
							mandatory: isTruthy(d.mandatory),
							readOnly: isTruthy(d.read_only),
						};
					});
					const choiceFields = fieldNames.filter((f) => dictMap[f] && isChoice(dictMap[f].type));
					if (!choiceFields.length) return { sectionList, elementList, dictMap, choicesMap: {} };
					return snFetch(
						`/api/now/table/sys_choice` +
						`?sysparm_query=name=${enc(table)}^elementIN${choiceFields.join(',')}^inactive=false` +
						`&sysparm_fields=element,value,label&sysparm_orderby=sequence&sysparm_limit=1000`
					).then((choiceRes) => {
						const choicesMap = {};
						(choiceRes.result || []).forEach((c) => {
							if (!choicesMap[c.element]) choicesMap[c.element] = [];
							choicesMap[c.element].push({ value: c.value, label: c.label });
						});
						return { sectionList, elementList, dictMap, choicesMap };
					});
				});
			});
		})
		.then(({ sectionList, elementList, dictMap, choicesMap }) => {
			const bySection = {};
			(elementList || []).forEach((el) => {
				const sid = refVal(el.sys_ui_section);
				if (!sid) return;
				if (!bySection[sid]) bySection[sid] = [];
				const dict = (dictMap || {})[el.element] || { label: toLabel(el.element), type: 'string', mandatory: false, readOnly: false };
				bySection[sid].push({
					name: el.element,
					label: dict.label,
					fieldType: dict.type,
					mandatory: dict.mandatory,
					readOnly: dict.readOnly,
					choices: (choicesMap || {})[el.element] || [],
				});
			});
			return (sectionList || [])
				.map((s) => ({
					sys_id: s.sys_id,
					caption: s.caption || 'Details',
					columns: Math.min(Math.max(parseInt(s.columns, 10) || 2, 1), 4),
					fields: bySection[s.sys_id] || [],
				}))
				.filter((s) => s.fields.length > 0);
		})
	);

	return Promise.all([sectionsPromise, policiesPromise, uiActionsPromise, recordPromise])
		.then(([sections, policies, uiActions, recRes]) => ({
			sections,
			policies,
			uiActions,
			values: flatValues(recRes.result),
		}));
};

/* ── Shared field-change logic (dirty track + auto-save + policy re-eval) */
const applyFieldChange = (name, value, state, updateState, dispatch) => {
	const newValues = { ...state.values, [name]: value };
	const dirty = state.dirtyFields.includes(name)
		? state.dirtyFields
		: [...state.dirtyFields, name];
	updateState({ values: newValues, dirtyFields: dirty, saveError: null });
	dispatch('RF_EVALUATE_POLICIES', { values: newValues });
	dispatch('FIELD_CHANGED', { name, value });
	const autoSave = parseAutoSave(state.properties.autoSaveFields);
	if (autoSave.includes(name)) {
		patchRecord(state.properties.table, state.properties.sysId, { [name]: value })
			.then(() => dispatch('FIELD_AUTO_SAVED', { name, value }))
			.catch((err) => { updateState({ saveError: err.message }); dispatch('FORM_SAVE_ERROR', { error: err.message }); });
	}
};

/* ── View ────────────────────────────────────────────────────── */

const view = (state, { dispatch }) => {
	const { table, sysId, formView, formTitle, saveLabel, readonly, actionBarPosition } = state.properties;
	const loadKey = `${table}|${sysId}|${formView}`;

	if (table && sysId && loadKey !== state.loadKey && !state.loading) {
		dispatch('RF_LOAD', {});
	}

	if (!table || !sysId) return <div className="rf-empty">Set table and sysId to load the form.</div>;

	if (state.loading || (!state.loaded && !state.error)) {
		return (
			<div className="rf-loading">
				<div className="rf-skeleton rf-skeleton--hd" />
				<div className="rf-skeleton" />
				<div className="rf-skeleton rf-skeleton--sm" />
			</div>
		);
	}

	if (state.error) return <div className="rf-error">{state.error}</div>;

	if (!state.sections || !state.sections.length) {
		return (
			<div className="rf-empty">
				No sections found for view "{formView}" on table "{table}".
			</div>
		);
	}

	const values = state.values || {};
	const expanded = state.expandedSections || {};
	const policyOvr = state.policyOverrides || {};
	const isFormReadOnly = Boolean(readonly);
	const autoSave = parseAutoSave(state.properties.autoSaveFields);
	const nonAutoDirty = (state.dirtyFields || []).filter((f) => !autoSave.includes(f));
	const barPos = actionBarPosition || 'bottom';

	/* Evaluate UI action conditions against current values */
	const visibleActions = (state.uiActions || []).filter(
		(a) => evaluateActionCondition(a.condition, values)
	);
	const hasSave = !isFormReadOnly;
	const showBar = visibleActions.length > 0 || hasSave;

	/* Action bar — rendered at top and/or bottom */
	const actionBar = showBar ? (
		<div className="rf-action-bar">
			{visibleActions.map((action) => (
				<now-button
					label={String(action.name || action.action_name)}
					variant="secondary"
					size="md"
					hint={action.hint || ''}
					on-click={() => dispatch('RF_UI_ACTION', { action })}
				/>
			))}
			{hasSave ? (
				<now-button
					label={state.saving ? 'Saving…' : String(saveLabel || 'Save')}
					variant="primary"
					size="md"
					disabled={Boolean(!nonAutoDirty.length || state.saving)}
					on-click={() => dispatch('RF_SAVE', {})}
				/>
			) : null}
		</div>
	) : null;

	return (
		<div className="rf-root">
			{/* Form header: title + action bar (if top/both) */}
			{formTitle || (showBar && (barPos === 'top' || barPos === 'both')) ? (
				<div className="rf-form-header">
					{formTitle ? <span className="rf-form-title">{formTitle}</span> : null}
					{showBar && (barPos === 'top' || barPos === 'both') ? actionBar : null}
				</div>
			) : null}

			{state.saveError ? <div className="rf-save-error">{state.saveError}</div> : null}

			{/* Sections — each wrapped so the named slot renders BETWEEN cards.
			 *   after-section-0 … after-section-9: drop any component here in UI Builder.
			 *   Unused slots render nothing and take zero space. */}
			{state.sections.map((section, idx) => {
				const isOpen = expanded[section.sys_id] !== false;
				return (
					<div className="rf-section-wrap">
						<now-card className="rf-section" interaction="none">
							<button
								type="button"
								className="rf-section-header"
								aria-expanded={isOpen ? 'true' : 'false'}
								on-click={() => dispatch('RF_TOGGLE_SECTION', { sectionId: section.sys_id })}
							>
								<span className="rf-section-caption">{section.caption}</span>
								<now-icon
									className={`rf-chevron${isOpen ? ' rf-chevron--open' : ''}`}
									icon="chevron-down-outline"
									size="sm"
								/>
							</button>

							{isOpen ? (
								<div className={`rf-grid rf-grid--cols-${section.columns}`}>
									{section.fields.map((field) => {
										const ovr = policyOvr[field.name] || {};
										const isMandatory = ovr.mandatory != null ? ovr.mandatory : field.mandatory;
										const isReadOnly = isFormReadOnly || (ovr.readOnly != null ? ovr.readOnly : field.readOnly);
										const isVisible = ovr.visible != null ? ovr.visible : true;
										if (!isVisible) return null;

										const rawVal = values[field.name];
										const strVal = rawVal == null ? '' : String(rawVal);

										/* ── Boolean → now-toggle ── */
										if (isBool(field.fieldType)) {
											const checked = rawVal === 'true' || rawVal === true || rawVal === '1';
											return (
												<div className={`rf-field rf-field--toggle${isMandatory ? ' rf-field--required' : ''}`}>
													<span className="rf-field-label">
														{field.label}
														{isMandatory ? <span className="rf-asterisk" aria-hidden="true"> *</span> : null}
													</span>
													<span
														className="rf-toggle-wrap"
														on-click={() => {
															if (isReadOnly) return;
															dispatch('RF_FIELD_TOGGLE', { name: field.name, value: checked ? 'false' : 'true' });
														}}
													>
														<now-toggle checked={checked} disabled={Boolean(isReadOnly)} size="md" configAria={{ switch: { 'aria-label': field.label } }} />
													</span>
												</div>
											);
										}

										/* ── Choice → now-dropdown ── */
										if (isChoice(field.fieldType) && field.choices.length) {
											const items = field.choices.map((c) => ({ id: encodeChoice(field.name, c.value), label: c.label }));
											const encodedCurrent = encodeChoice(field.name, strVal);
											const selectedItems = items.some((i) => i.id === encodedCurrent) ? [encodedCurrent] : [];
											return (
												<div className={`rf-field${isMandatory ? ' rf-field--required' : ''}`}>
													<span className="rf-field-label">
														{field.label}
														{isMandatory ? <span className="rf-asterisk" aria-hidden="true"> *</span> : null}
													</span>
													<now-dropdown items={items} selectedItems={selectedItems} select="single" size="md" disabled={Boolean(isReadOnly)} configAria={{ trigger: { 'aria-label': field.label } }} />
												</div>
											);
										}

										/* ── Reference → readonly display ── */
										if (isRef(field.fieldType)) {
											return <now-input name={field.name} label={field.label} value={strVal} readonly={true} size="md" />;
										}

										/* ── All other types → now-input ── */
										return (
											<now-input
												name={field.name}
												label={field.label}
												value={strVal}
												type={inputTypeFor(field.fieldType)}
												readonly={Boolean(isReadOnly)}
												required={Boolean(isMandatory)}
												size="md"
											/>
										);
									})}
								</div>
							) : null}
						</now-card>

						{/* Named slot — rendered after each section card, before the next */}
						{idx < 10 ? (
							<div className="rf-section-slot">
								<slot name={`after-section-${idx}`}></slot>
							</div>
						) : null}
					</div>
				);
			})}

			{/* Action bar at bottom (default) */}
			{showBar && (barPos === 'bottom' || barPos === 'both') ? actionBar : null}
		</div>
	);
};

/* ── Component ───────────────────────────────────────────────── */

createCustomElement('x-gegis-library-record-form', {
	renderer: { type: snabbdom },
	view,
	styles,
	slots: {
		'after-section-0': {}, 'after-section-1': {}, 'after-section-2': {},
		'after-section-3': {}, 'after-section-4': {}, 'after-section-5': {},
		'after-section-6': {}, 'after-section-7': {}, 'after-section-8': {},
		'after-section-9': {},
	},
	initialState: {
		loadKey: '',
		loading: false,
		saving: false,
		loaded: false,
		error: null,
		saveError: null,
		sections: [],
		values: {},
		origValues: {},
		dirtyFields: [],
		expandedSections: {},
		policies: [],
		policyOverrides: {},
		uiActions: [],
	},
	properties: {
		table: { default: '' },
		sysId: { default: '' },
		formView: { default: 'Default view' },
		formTitle: { default: '' },
		actionBarPosition: { default: 'bottom' },
		autoSaveFields: { default: [] },
		saveLabel: { default: 'Save' },
		readonly: { default: false },
	},
	actionHandlers: {

		/* Debounced load — 800ms absorbs playground typing, VPN latency */
		RF_LOAD: ({ state, updateState, dispatch }) => {
			const { table, sysId, formView } = state.properties;
			if (!table || !sysId) return;
			const loadKey = `${table}|${sysId}|${formView}`;
			if (state.loadKey === loadKey && state.loaded) return;
			updateState({ loadKey });
			clearTimeout(_loadTimer);
			_loadTimer = setTimeout(() => {
				updateState({ loading: true, error: null, saveError: null, sections: [], values: {}, dirtyFields: [], expandedSections: {}, policies: [], policyOverrides: {}, uiActions: [] });
				loadFormAndRecord(table, sysId, formView)
					.then(({ sections, policies, uiActions, values }) => {
						const expandedSections = {};
						sections.forEach((s) => { expandedSections[s.sys_id] = true; });
						const policyOverrides = applyPolicies(policies, values);
						updateState({ sections, policies, uiActions, values, origValues: values, loading: false, loaded: true, expandedSections, policyOverrides });
					})
					.catch((err) => {
						updateState({ loading: false, error: err.message });
						dispatch('FORM_LOAD_ERROR', { error: err.message });
					});
			}, 800);
		},

		/* Re-evaluate policies whenever values change */
		RF_EVALUATE_POLICIES: ({ action, state, updateState }) => {
			const values = (action.payload && action.payload.values) || state.values;
			updateState({ policyOverrides: applyPolicies(state.policies, values) });
		},

		/* Section collapse toggle */
		RF_TOGGLE_SECTION: ({ action, state, updateState }) => {
			const { sectionId } = action.payload;
			updateState({ expandedSections: { ...state.expandedSections, [sectionId]: !state.expandedSections[sectionId] } });
		},

		/* Boolean field toggle */
		RF_FIELD_TOGGLE: ({ action, state, updateState, dispatch }) => {
			applyFieldChange(action.payload.name, action.payload.value, state, updateState, dispatch);
		},

		/* Save dirty non-auto-save fields */
		RF_SAVE: ({ state, updateState, dispatch }) => {
			const autoSave = parseAutoSave(state.properties.autoSaveFields);
			const toSave = (state.dirtyFields || []).filter((f) => !autoSave.includes(f));
			if (!toSave.length || state.saving) return;
			const payload = {};
			toSave.forEach((f) => { payload[f] = state.values[f]; });
			updateState({ saving: true, saveError: null });
			patchRecord(state.properties.table, state.properties.sysId, payload)
				.then(() => {
					const remaining = (state.dirtyFields || []).filter((f) => !toSave.includes(f));
					updateState({ saving: false, dirtyFields: remaining });
					dispatch('FORM_SAVED', { values: payload });
				})
				.catch((err) => {
					updateState({ saving: false, saveError: err.message });
					dispatch('FORM_SAVE_ERROR', { error: err.message });
				});
		},

		/* UI Action button clicked → emit external event with full context */
		RF_UI_ACTION: ({ action: dispatchedAction, state, dispatch }) => {
			const uiAction = dispatchedAction.payload.action;
			dispatch('UI_ACTION_TRIGGERED', {
				name: uiAction.name,
				actionName: uiAction.action_name,
				sysId: state.properties.sysId,
				table: state.properties.table,
				values: state.values,
			});
		},

		/* now-input blur */
		'NOW_INPUT#VALUE_SET': ({ action, state, updateState, dispatch }) => {
			const { name, value } = action.payload || {};
			if (!name) return;
			applyFieldChange(name, value, state, updateState, dispatch);
		},

		/* now-dropdown selection (choice fields) */
		'NOW_DROPDOWN#SELECTED_ITEMS_SET': ({ action, state, updateState, dispatch }) => {
			const raw = action.payload && action.payload.value;
			const selected = Array.isArray(raw) ? raw[0] : raw;
			if (!selected) return;
			const { name, value } = decodeChoice(selected);
			if (!name) return;
			applyFieldChange(name, value, state, updateState, dispatch);
		},
	},
});
