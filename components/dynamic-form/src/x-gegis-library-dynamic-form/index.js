import { createCustomElement } from '@servicenow/ui-core';
import snabbdom from '@servicenow/ui-renderer-snabbdom';
import styles from './styles.scss';

/* ------------------------------------------------------------------ *
 * x-gegis-library-dynamic-form
 * A metadata-driven, sectioned form.
 *
 * Input:
 *   - `sections` (JSON array): the grouping metadata (comes from external
 *      metadata, as discussed). Each: { sectionName, fields:[ field ] }.
 *      field = { label, name, type:'select'|'text', options?, placeholder?,
 *                readonly?, value? }.
 *   - `values` (JSON object): current values keyed by field `name` (bind your
 *      record here). Editing a field updates this map.
 *
 * Save: dispatches FORM_SAVED { values } — bind that event to a REST / transform
 * data resource in UI Builder to perform the actual HTTP save. (The component
 * does NOT call fetch itself — auth/headers/scope belong to a data resource.)
 *
 * 100% CUSTOM, zero now-* deps. Select chevron is pure CSS (no JSX <svg>).
 * Lessons applied: string class names; no `state` config key (edits live in the
 * `values` property via updateProperties); defensive array/object handling.
 * ------------------------------------------------------------------ */

const fieldName = (f) => f.name || f.label || '';

const valueFor = (values, f) => {
	const nm = fieldName(f);
	if (values && Object.prototype.hasOwnProperty.call(values, nm)) return values[nm];
	return f.value != null ? f.value : '';
};

const normalizeOptions = (opts) =>
	(Array.isArray(opts) ? opts : []).map((o) => (typeof o === 'string' ? { label: o, value: o } : o));

const view = (state, { updateProperties, dispatch }) => {
	const { sections, values, columns, saveLabel, showSave } = state.properties;
	const secs = Array.isArray(sections) ? sections : [];
	const vals = values && typeof values === 'object' ? values : {};
	const cols = Number(columns) > 0 ? Number(columns) : 3;
	const gridStyle = { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` };

	const setValue = (nm, v) => {
		updateProperties({ values: { ...vals, [nm]: v } });
		dispatch('FIELD_CHANGED', { name: nm, value: v });
	};

	const renderField = (f) => {
		const nm = fieldName(f);
		const val = valueFor(vals, f);
		const ph = f.placeholder || '';
		const readonly = !!f.readonly || f.type === 'readonly';

		if (f.type === 'select') {
			const opts = normalizeOptions(f.options);
			return (
				<div className="ff-field">
					<label className="ff-label">{f.label}</label>
					<span className="ff-select-wrap">
						<select
							className={`ff-select${readonly ? ' ff-control--ro' : ''}`}
							disabled={readonly}
							value={String(val)}
							on-change={(e) => setValue(nm, e && e.target ? e.target.value : '')}
						>
							{ph ? <option value="">{ph}</option> : null}
							{opts.map((o) => (
								<option value={String(o.value)}>{o.label}</option>
							))}
						</select>
						<span className="ff-chev" aria-hidden="true"></span>
					</span>
				</div>
			);
		}

		return (
			<div className="ff-field">
				<label className="ff-label">{f.label}</label>
				<input
					className={`ff-input${readonly ? ' ff-control--ro' : ''}`}
					type="text"
					value={String(val)}
					placeholder={ph}
					disabled={readonly}
					on-input={(e) => setValue(nm, e && e.target ? e.target.value : '')}
				/>
			</div>
		);
	};

	const onSave = () => {
		const full = {};
		secs.forEach((s) => (s.fields || []).forEach((f) => {
			full[fieldName(f)] = valueFor(vals, f);
		}));
		dispatch('FORM_SAVED', { values: full });
	};

	return (
		<div className="ff-root">
			{secs.map((sec) => (
				<div className="ff-card">
					{sec.sectionName ? <div className="ff-section-title">{sec.sectionName}</div> : null}
					<div className="ff-grid" style={gridStyle}>
						{(sec.fields || []).map((f) => renderField(f))}
					</div>
				</div>
			))}

			{showSave && secs.length ? (
				<div className="ff-actions">
					<button type="button" className="ff-save" on-click={onSave}>
						{saveLabel || 'Save'}
					</button>
				</div>
			) : null}
		</div>
	);
};

createCustomElement('x-gegis-library-dynamic-form', {
	renderer: { type: snabbdom },
	view,
	styles,
	properties: {
		sections: { default: [] },
		values: { default: {} },
		columns: { default: 3 },
		saveLabel: { default: 'Save' },
		showSave: { default: true },
	},
});
