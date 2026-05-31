import { createCustomElement } from '@servicenow/ui-core';
import snabbdom from '@servicenow/ui-renderer-snabbdom';
import styles from './styles.scss';

/* ------------------------------------------------------------------ *
 * x-gegis-library-extraction-summary
 * A fully custom extraction / version summary card.
 *
 * 100% CUSTOM (owned markup), justified: this is a bespoke data card with a
 * pixel-specific layout (version picker + green summary card + colored stats +
 * red low-confidence warning) that no single default component reproduces. It
 * uses ZERO `now-*` dependencies — explicitly NOT now-alert — so it can't hit
 * the bundling / process / icon-library issues, and renders identically locally
 * and on the instance. Icons are drawn in pure CSS (no JSX <svg>, which the
 * snabbdom renderer mishandles).
 *
 * Lessons applied: class names are STRINGS (never objects); no `state` config
 * key (selection lives in the `selectedId` property, flipped via
 * updateProperties); choice/array handled defensively.
 * ------------------------------------------------------------------ */

const renderCard = (v) => {
	const lowConf = Number(v.lowConfidence) || 0;
	return (
		<div className="es-card">
			<div className="es-card-head">
				<span className="es-check" aria-hidden="true"></span>
				<span className="es-name">{v.name}</span>
				{v.current ? <span className="es-badge">CURRENT</span> : null}
			</div>
			<div className="es-meta">
				Created: {v.created} • Triggered by: {v.triggeredBy}
			</div>
			<div className="es-stats">
				<span className="es-stat">
					<span className="es-stat-num">{v.documents}</span> documents
				</span>
				<span className="es-stat">
					<span className="es-stat-num">{v.totalFields}</span> Total fields
				</span>
				<span className="es-stat es-stat--green">
					<span className="es-stat-num">{v.newFields}</span> New field
				</span>
				<span className="es-stat es-stat--blue">
					<span className="es-stat-num">{v.modified}</span> modified
				</span>
			</div>
			{lowConf > 0 ? (
				<div className="es-warn">
					<span className="es-warn-icon" aria-hidden="true">!</span>
					<span className="es-warn-text">
						<span className="es-warn-num">{lowConf}</span> data fields have{' '}
						<strong>Low confidence</strong>. <strong>Manual Review Required</strong>
					</span>
				</div>
			) : null}
		</div>
	);
};

const view = (state, { updateProperties, dispatch }) => {
	const { versions, selectedId, versionLabel, button1Label, button2Label } = state.properties;
	const list = Array.isArray(versions) ? versions : [];
	const selected = list.find((v) => String(v.id) === String(selectedId)) || list[0] || null;

	const onSelect = (e) => {
		const id = e && e.target ? e.target.value : '';
		updateProperties({ selectedId: id });
		dispatch('VERSION_CHANGED', { id });
	};

	return (
		<div className="es-root">
			<div className="es-toolbar">
				<div className="es-picker">
					<span className="es-picker-label">{versionLabel}</span>
					<span className="es-select-wrap">
						<select
							className="es-select"
							value={selected ? String(selected.id) : ''}
							on-change={onSelect}
						>
							{list.map((v) => (
								<option value={String(v.id)}>{v.label || v.name || v.id}</option>
							))}
						</select>
						<span className="es-select-chevron" aria-hidden="true"></span>
					</span>
				</div>
				<div className="es-actions">
					<button
						type="button"
						className="es-btn"
						on-click={() => dispatch('VIEW_TIMELINE_CLICKED', { id: selected ? selected.id : null })}
					>
						<span className="es-clock" aria-hidden="true"></span>
						<span>{button1Label}</span>
					</button>
					<button
						type="button"
						className="es-btn"
						on-click={() => dispatch('PROCEED_TO_AUDIT_CLICKED', { id: selected ? selected.id : null })}
					>
						{button2Label}
					</button>
				</div>
			</div>

			{selected ? renderCard(selected) : <div className="es-empty">No version data.</div>}
		</div>
	);
};

createCustomElement('x-gegis-library-extraction-summary', {
	renderer: { type: snabbdom },
	view,
	styles,
	properties: {
		versions: { default: [] },
		selectedId: { default: '' },
		versionLabel: { default: 'Version:' },
		button1Label: { default: 'View Extraction Timeline' },
		button2Label: { default: 'Proceed to Data Audit' },
	},
});
