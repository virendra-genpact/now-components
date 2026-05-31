import { createCustomElement } from '@servicenow/ui-core';
import snabbdom from '@servicenow/ui-renderer-snabbdom';
import styles from './styles.scss';

/* ------------------------------------------------------------------ *
 * x-gegis-library-quote-comparison
 * A fully custom quote-versions comparison grid.
 *
 * Input: a JSON ARRAY of version objects (v1, v2, v3 — e.g. 3 records from the
 * same table), each shaped { header, sections[], actions[] }. Versions render as
 * COLUMNS; fields (grouped by section) render as ROWS. The first version defines
 * the row structure; each column pulls its value at the same section/field index
 * (the versions share the same fields).
 *
 * 100% CUSTOM (owned markup), zero now-* deps (no now-alert). CSS grid for the
 * table; ✓/✗ are unicode glyphs (no JSX <svg>). Lessons applied: string class
 * names only; no `state` config key; defensive array handling.
 * ------------------------------------------------------------------ */

const bodySectionsOf = (v) => ((v && v.sections) || []).filter((s) => s.type !== 'header_summary');
const summaryOf = (v) => ((v && v.sections) || []).find((s) => s.type === 'header_summary') || null;

/* Render a single field's value cell content per its displayType. */
const renderValue = (field) => {
	if (!field) return null;
	const dt = field.displayType;

	if (dt === 'tick_cross') {
		return field.value
			? <span className="qc-tick" aria-label="Yes">✓</span>
			: <span className="qc-cross" aria-label="No">✕</span>;
	}
	if (dt === 'pill') {
		const color = field.pillColor || 'gray';
		return <span className={`qc-pill qc-pill--${color}`}>{field.value}</span>;
	}

	const text = field.formatted != null ? field.formatted : field.value != null ? String(field.value) : '';
	const bold = dt === 'currency_bold' || field.isAggregation;

	let trend = null;
	const t = field.trend;
	if (t && t.direction) {
		const arrow = t.direction === 'increase' ? '▲' : '▼';
		const vb = t.vsBaseline;
		const tone = (vb && vb.color) || (t.direction === 'decrease' ? 'green' : 'red');
		trend = (
			<span className={`qc-trend qc-trend--${tone}`}>
				{arrow}{vb && vb.formatted ? ` ${vb.formatted}` : ''}
			</span>
		);
	}

	return (
		<span className={`qc-val${bold ? ' qc-val--bold' : ''}${dt === 'text_truncated' ? ' qc-val--trunc' : ''}`}>
			{text}
			{trend}
		</span>
	);
};

const view = (state, { dispatch }) => {
	const { versions, title, labelWidth } = state.properties;
	const list = Array.isArray(versions) ? versions : [];
	const n = list.length;

	if (!n) return <div className="qc-empty">No versions to compare.</div>;

	const head0 = list[0].header || {};
	const titleText = head0.title || title || 'Comparison';
	const summary0 = summaryOf(list[0]);
	const body0 = bodySectionsOf(list[0]);

	const gridStyle = { gridTemplateColumns: `${labelWidth || '200px'} repeat(${n}, minmax(0, 1fr))` };

	const cells = [];

	/* Title (spans all columns). */
	cells.push(<div className="qc-title">{titleText}</div>);

	/* Version header row: label cell = summary section name, then one head per version. */
	cells.push(<div className="qc-headlabel">{summary0 ? summary0.sectionName : ''}</div>);
	list.forEach((v, i) => {
		const h = v.header || {};
		const st = h.status;
		cells.push(
			<div className="qc-headcell">
				<div className="qc-option">{h.option}</div>
				{st ? <span className={`qc-pill qc-pill--${st.color || 'green'}`}>{st.label}</span> : null}
				{h.selectable ? (
					<label className="qc-select">
						<input
							type="checkbox"
							on-change={(e) =>
								dispatch('VERSION_SELECTED', { index: i, checked: !!(e && e.target && e.target.checked) })
							}
						/>
						<span>Select</span>
					</label>
				) : null}
			</div>
		);
	});

	/* header_summary fields (plain rows, no band). */
	if (summary0) {
		(summary0.fields || []).forEach((f, fi) => {
			cells.push(<div className="qc-rowlabel">{f.label}</div>);
			list.forEach((v) => {
				const vf = ((summaryOf(v) || {}).fields || [])[fi];
				const center = vf && vf.displayType === 'tick_cross';
				cells.push(<div className={`qc-cell${center ? ' qc-cell--center' : ''}`}>{renderValue(vf)}</div>);
			});
		});
	}

	/* Body sections: gray band + field rows. */
	body0.forEach((sec, si) => {
		cells.push(<div className="qc-band">{sec.sectionName}</div>);
		(sec.fields || []).forEach((f, fi) => {
			const agg = f.isAggregation || f.displayType === 'currency_bold';
			cells.push(<div className={`qc-rowlabel${agg ? ' qc-rowlabel--agg' : ''}`}>{f.label}</div>);
			list.forEach((v) => {
				const vf = ((bodySectionsOf(v)[si] || {}).fields || [])[fi];
				const center = vf && vf.displayType === 'tick_cross';
				cells.push(
					<div className={`qc-cell${agg ? ' qc-cell--agg' : ''}${center ? ' qc-cell--center' : ''}`}>
						{renderValue(vf)}
					</div>
				);
			});
		});
	});

	/* Actions footer (per version). */
	const acts0 = list[0].actions || [];
	if (acts0.length) {
		cells.push(<div className="qc-rowlabel"></div>);
		list.forEach((v, i) => {
			cells.push(
				<div className="qc-cell qc-actions">
					{(v.actions || []).map((a) => (
						<button
							type="button"
							className={`qc-btn qc-btn--${a.style || 'secondary'}`}
							on-click={() => dispatch('ACTION_CLICKED', { index: i, action: a.label })}
						>
							{a.label}
						</button>
					))}
				</div>
			);
		});
	}

	return (
		<div className="qc-grid" style={gridStyle}>
			{cells}
		</div>
	);
};

createCustomElement('x-gegis-library-quote-comparison', {
	renderer: { type: snabbdom },
	view,
	styles,
	properties: {
		versions: { default: [] },
		title: { default: 'Quote Versions Comparison' },
		labelWidth: { default: '200px' },
	},
});
