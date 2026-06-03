import { createCustomElement } from '@servicenow/ui-core';
import snabbdom from '@servicenow/ui-renderer-snabbdom';
import styles from './styles.scss';

/* ------------------------------------------------------------------ *
 * x-gegis-library-record-form  (experimental)
 *
 * Self-fetching record form: give it table + sysId + formView and it reads
 * the form layout from sys_ui_section / sys_ui_element, fetches the record
 * values, and renders everything as editable now-input fields grouped by
 * their form-builder sections.
 *
 * auto-save fields (autoSaveFields prop): PATCH the record on every blur.
 * all other fields: dirty-tracked and saved together on the Save button.
 *
 * Fetch calls go through the dev-server proxy (/api/* → instance).
 * On the deployed instance the same /api/* URLs are native.
 * ------------------------------------------------------------------ */

/* ── Helpers ─────────────────────────────────────────────────── */

const toLabel = (name) =>
	String(name || '')
		.replace(/_/g, ' ')
		.replace(/\b\w/g, (c) => c.toUpperCase());

const parseJson = (raw, fallback) => {
	if (!raw) return fallback;
	if (typeof raw === 'object') return raw;
	try { return JSON.parse(raw); } catch (e) { return fallback; }
};

const parseAutoSave = (raw) => {
	const arr = parseJson(raw, []);
	return Array.isArray(arr) ? arr : [];
};

const snFetch = (url) =>
	fetch(url, { headers: { Accept: 'application/json' }, credentials: 'same-origin' })
		.then((r) => {
			if (!r.ok) throw new Error(`HTTP ${r.status} — ${url}`);
			return r.json();
		});

/* ServiceNow Table API returns fields as { display_value, value } objects when
 * sysparm_display_value=true. Flatten to plain strings for easy use. */
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

/* ── Form layout fetch ───────────────────────────────────────── *
 * Correct ServiceNow schema (from FormLayoutHelper analysis):
 *
 *  sys_ui_section:
 *    .name  = TABLE name (e.g. "incident")    ← was wrong before (used for view name)
 *    .view  = VIEW name string (e.g. "Default view", "sow_incident_overview")
 *    .caption = section heading
 *
 *  sys_ui_element:
 *    .sys_ui_section = reference to sys_ui_section  ← was wrong before (used "view")
 *    .element = field name (empty for layout rows)
 *    .type    = element type
 *
 *  TWO layout patterns — try multi-section first, fall back to single-section:
 *    Multi:   sys_ui_form → sys_ui_form_section → sys_ui_section → sys_ui_element
 *    Single:  sys_ui_section (name=table, view=viewName) → sys_ui_element
 *
 *  sys_dictionary: element, column_label (proper label), internal_type (field type)
 *
 *  Record fetch runs in parallel with the layout chain (independent).
 * ─────────────────────────────────────────────────────────────── */

/* Extract sys_id from a REST reference field (may be object or plain string). */
const refVal = (v) => (v && typeof v === 'object' ? v.value : v) || '';

/* Module-level debounce timer — absorbs rapid-fire RF_LOAD dispatches that
 * occur when the user types into the playground property inputs char-by-char. */
let _loadTimer = null;

const loadFormAndRecord = (table, sysId, formView) => {
	const enc = encodeURIComponent;

	/* ── Record fetch (independent — runs in parallel) ─────────── */
	const recordPromise = snFetch(
		`/api/now/table/${enc(table)}/${enc(sysId)}?sysparm_display_value=true`
	);

	/* ── Layout chain ───────────────────────────────────────────── *
	 * Facts from FormLayoutHelper (server-side GlideRecord):
	 *   sys_ui_view.name  = internal name ('itil', '' for Default view)
	 *   sys_ui_view.title = human title   ('ITIL', 'Default view')
	 *   sys_ui_form.view  = sys_ui_view.name  (internal name — '' for Default!)
	 *   sys_ui_section.view = sys_ui_view.sys_id (the raw sys_id, NOT the name)
	 *
	 * Step 1: resolve the view to get BOTH internal name and sys_id.
	 * Step 2: try multi-section (sys_ui_form uses internal name).
	 * Step 3: fall back to single-section (sys_ui_section uses sys_id).
	 * ─────────────────────────────────────────────────────────────── */

	const layoutPromise = snFetch(
		// Resolve view: try title first ('Default view'), then internal name ('itil').
		`/api/now/table/sys_ui_view` +
		`?sysparm_query=title=${enc(formView)}^ORname=${enc(formView)}` +
		`&sysparm_fields=sys_id,name,title&sysparm_limit=5`
	)
	.then((viewRes) => {
		const view = viewRes.result && viewRes.result[0];
		if (!view) {
			throw new Error(
				`View "${formView}" not found in sys_ui_view. ` +
				`Check the exact title (e.g. "Default view", "ITIL").`
			);
		}
		// Internal name is '' for Default view; sys_id used for sys_ui_section.view.
		const viewInternalName = view.name || '';
		const viewSysId = view.sys_id;

		// Try multi-section (sys_ui_form.view = internal name).
		return snFetch(
			`/api/now/table/sys_ui_form` +
			`?sysparm_query=name=${enc(table)}^view=${enc(viewInternalName)}` +
			`&sysparm_fields=sys_id&sysparm_limit=1`
		).then((formRes) => ({ formRes, viewInternalName, viewSysId }));
	})
	.then(({ formRes, viewInternalName, viewSysId }) => {
		const form = formRes.result && formRes.result[0];

		if (form) {
			// ── Multi-section via sys_ui_form → sys_ui_form_section ──
			return snFetch(
				`/api/now/table/sys_ui_form_section` +
				`?sysparm_query=sys_ui_form=${enc(form.sys_id)}` +
				`&sysparm_fields=sys_ui_section,position` +
				`&sysparm_orderby=position&sysparm_limit=50`
			).then((fsRes) => {
				const orderedIds = (fsRes.result || [])
					.map((fs) => refVal(fs.sys_ui_section))
					.filter(Boolean);
				if (!orderedIds.length) return { sectionList: [], orderedIds: [] };
				return snFetch(
					`/api/now/table/sys_ui_section` +
					`?sysparm_query=sys_idIN${orderedIds.join(',')}` +
					`&sysparm_fields=sys_id,caption,columns&sysparm_limit=50`
				).then((secRes) => {
					const byId = {};
					(secRes.result || []).forEach((s) => { byId[s.sys_id] = s; });
					const sectionList = orderedIds.map((id) => byId[id]).filter(Boolean);
					return { sectionList, orderedIds };
				});
			});
		}

		// ── Single-section: sys_ui_section.view = sys_ui_view.sys_id ──
		return snFetch(
			`/api/now/table/sys_ui_section` +
			`?sysparm_query=name=${enc(table)}^view=${enc(viewSysId)}` +
			`&sysparm_fields=sys_id,caption,position,columns` +
			`&sysparm_orderby=position&sysparm_limit=50`
		).then((secRes) => {
			const sectionList = secRes.result || [];
			return { sectionList, orderedIds: sectionList.map((s) => s.sys_id) };
		});
	})
	.then(({ sectionList, orderedIds }) => {
		if (!orderedIds.length) return { sectionList: [], elementList: [], labels: {} };

		// ── Elements: sys_ui_element.sys_ui_section IN (section sys_ids) ──
		return snFetch(
			`/api/now/table/sys_ui_element` +
			`?sysparm_query=sys_ui_sectionIN${orderedIds.join(',')}` +
			`&sysparm_fields=element,type,position,sys_ui_section` +
			`&sysparm_orderby=position&sysparm_limit=500`
		).then((elRes) => {
			const elementList = (elRes.result || []).filter(
				(el) => el.element && el.type !== 'section_annotation' && el.type !== 'split_option'
			);
			const fieldNames = [...new Set(elementList.map((el) => el.element))];
			if (!fieldNames.length) return { sectionList, elementList, labels: {} };

			// ── sys_dictionary: proper labels + internal_type for all fields ──
			return snFetch(
				`/api/now/table/sys_dictionary` +
				`?sysparm_query=name=${enc(table)}^elementIN${fieldNames.join(',')}` +
				`&sysparm_fields=element,column_label,internal_type` +
				`&sysparm_display_value=true&sysparm_limit=500`
			).then((dictRes) => {
				const labels = {};
				(dictRes.result || []).forEach((d) => {
					labels[d.element] = {
						label: d.column_label || toLabel(d.element),
						type: d.internal_type || 'string',
					};
				});
				return { sectionList, elementList, labels };
			});
		});
	})
	.then(({ sectionList, elementList, labels }) => {
		// Group elements by section, preserving position order within each section.
		const bySection = {};
		(elementList || []).forEach((el) => {
			const sid = refVal(el.sys_ui_section);
			if (!sid) return;
			if (!bySection[sid]) bySection[sid] = [];
			const meta = (labels || {})[el.element] || { label: toLabel(el.element), type: 'string' };
			bySection[sid].push({
				name: el.element,
				label: meta.label,
				fieldType: meta.type,
			});
		});

		return (sectionList || [])
			.map((s) => ({
				sys_id: s.sys_id,
				caption: s.caption || '',
				columns: s.columns || '2',
				fields: bySection[s.sys_id] || [],
			}))
			.filter((s) => s.fields.length > 0);
	});

	return Promise.all([layoutPromise, recordPromise])
		.then(([sections, recRes]) => ({
			sections,
			values: flatValues(recRes.result),
		}));
};

const patchRecord = (table, sysId, payload) =>
	fetch(`/api/now/table/${encodeURIComponent(table)}/${encodeURIComponent(sysId)}`, {
		method: 'PATCH',
		headers: {
			'Content-Type': 'application/json',
			Accept: 'application/json',
			'X-Requested-With': 'XMLHttpRequest',
		},
		credentials: 'same-origin',
		body: JSON.stringify(payload),
	}).then((r) => {
		if (!r.ok) throw new Error(`Save failed: HTTP ${r.status}`);
		return r.json();
	});

/* ── View ─────────────────────────────────────────────────────── */

const view = (state, { dispatch }) => {
	const { table, sysId, formView, saveLabel, readonly } = state.properties;
	const loadKey = `${table}|${sysId}|${formView}`;

	// Trigger (re-)load whenever table/sysId/formView changes.
	if (table && sysId && loadKey !== state.loadKey && !state.loading) {
		dispatch('RF_LOAD', {});
	}

	if (!table || !sysId) {
		return <div className="rf-empty">Set table and sysId to load the form.</div>;
	}

	if (state.loading || (!state.loaded && !state.error)) {
		return (
			<div className="rf-loading">
				<div className="rf-skeleton" />
				<div className="rf-skeleton rf-skeleton--sm" />
			</div>
		);
	}

	if (state.error) {
		return <div className="rf-error">{state.error}</div>;
	}

	if (!state.sections || !state.sections.length) {
		return (
			<div className="rf-empty">
				No sections found for view "{formView}" on table "{table}".
			</div>
		);
	}

	const values = state.values || {};
	const autoSave = parseAutoSave(state.properties.autoSaveFields);
	const nonAutoDirty = (state.dirtyFields || []).filter((f) => !autoSave.includes(f));

	return (
		<div className="rf-root">
			{state.saveError ? (
				<div className="rf-save-error">Save failed: {state.saveError}</div>
			) : null}
			{state.sections.map((section) => {
				// Use the section's declared column count from the form builder (1, 2 or 3).
				const cols = parseInt(section.columns, 10) || 2;
				return (
					<now-card className="rf-section" interaction="none">
						{section.caption ? (
							<div className="rf-section-title">{section.caption}</div>
						) : null}
						<div
							className="rf-grid"
							style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
						>
							{section.fields.map((field) => (
								<now-input
									name={field.name}
									label={field.label}
									value={String(values[field.name] == null ? '' : values[field.name])}
									readonly={Boolean(readonly)}
									size="md"
								/>
							))}
						</div>
					</now-card>
				);
			})}
			{!readonly ? (
				<div className="rf-footer">
					<now-button
						label={String(saveLabel || 'Save')}
						variant="primary"
						size="md"
						disabled={Boolean(!nonAutoDirty.length || state.saving)}
					/>
				</div>
			) : null}
		</div>
	);
};

/* ── Component ────────────────────────────────────────────────── */

createCustomElement('x-gegis-library-record-form', {
	renderer: { type: snabbdom },
	view,
	styles,
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
	},
	properties: {
		table: { default: '' },
		sysId: { default: '' },
		formView: { default: 'Default view' },
		autoSaveFields: { default: [] },
		saveLabel: { default: 'Save' },
		readonly: { default: false },
	},
	actionHandlers: {
		/* Fetch layout + record.
		 *
		 * Debounced 400ms: the view dispatches RF_LOAD on every render where
		 * loadKey changes (e.g. each keystroke in the playground). We absorb
		 * rapid-fire calls here and only start the actual fetch once typing
		 * settles, so we never fire with a truncated table/sysId. */
		RF_LOAD: ({ state, updateState, dispatch }) => {
			const { table, sysId, formView } = state.properties;
			if (!table || !sysId) return;
			const loadKey = `${table}|${sysId}|${formView}`;
			if (state.loadKey === loadKey && state.loaded) return;

			// Update loadKey immediately so the view guard stops re-dispatching
			// for this exact combination, then debounce the actual network calls.
			updateState({ loadKey });
			clearTimeout(_loadTimer);
			_loadTimer = setTimeout(() => {
				updateState({
					loading: true,
					error: null,
					saveError: null,
					sections: [],
					values: {},
					dirtyFields: [],
				});
				loadFormAndRecord(table, sysId, formView)
					.then(({ sections, values }) => {
						updateState({ sections, values, origValues: values, loading: false, loaded: true });
					})
					.catch((err) => {
						updateState({ loading: false, error: err.message });
						dispatch('FORM_LOAD_ERROR', { error: err.message });
					});
			}, 400);
		},

		/* now-input fires VALUE_SET on blur. Update state + optionally auto-save. */
		'NOW_INPUT#VALUE_SET': ({ action, state, updateState, dispatch }) => {
			const { name, value } = action.payload || {};
			if (!name) return;
			const values = { ...state.values, [name]: value };
			const dirty = state.dirtyFields.includes(name)
				? state.dirtyFields
				: [...state.dirtyFields, name];
			updateState({ values, dirtyFields: dirty });
			dispatch('FIELD_CHANGED', { name, value });

			const autoSave = parseAutoSave(state.properties.autoSaveFields);
			if (autoSave.includes(name)) {
				updateState({ saveError: null });
				patchRecord(state.properties.table, state.properties.sysId, { [name]: value })
					.then(() => dispatch('FIELD_AUTO_SAVED', { name, value }))
					.catch((err) => {
						updateState({ saveError: err.message });
						dispatch('FORM_SAVE_ERROR', { error: err.message });
					});
			}
		},

		/* now-button click → PATCH all non-auto-save dirty fields. */
		'NOW_BUTTON#CLICKED': ({ state, updateState, dispatch }) => {
			const autoSave = parseAutoSave(state.properties.autoSaveFields);
			const toSave = (state.dirtyFields || []).filter((f) => !autoSave.includes(f));
			if (!toSave.length || state.saving) return;

			const payload = {};
			toSave.forEach((f) => { payload[f] = state.values[f]; });
			updateState({ saving: true });

			patchRecord(state.properties.table, state.properties.sysId, payload)
				.then(() => {
					const remaining = (state.dirtyFields || []).filter((f) => !toSave.includes(f));
					updateState({ saving: false, saveError: null, dirtyFields: remaining });
					dispatch('FORM_SAVED', { values: payload });
				})
				.catch((err) => {
					updateState({ saving: false, saveError: err.message });
					dispatch('FORM_SAVE_ERROR', { error: err.message });
				});
		},
	},
});
