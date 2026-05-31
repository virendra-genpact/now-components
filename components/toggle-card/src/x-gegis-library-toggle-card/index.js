import { createCustomElement } from '@servicenow/ui-core';
import snabbdom from '@servicenow/ui-renderer-snabbdom';
import styles from './styles.scss';

/* ------------------------------------------------------------------ *
 * x-gegis-library-toggle-card
 * A single titled card with a list of on/off toggle rows.
 *
 * Input: `title` + an `items` JSON array — each { label, on, required }.
 * Toggling a row flips its `on` value (via updateProperties on the array) and
 * fires TOGGLE_CHANGED. Drop several of these to build a grid like the ref page.
 *
 * 100% CUSTOM, zero now-* deps. The switch is pure CSS (no JSX <svg>). Lessons
 * applied: string class names only; no `state` config key (state lives in the
 * `items` property); defensive array handling.
 * ------------------------------------------------------------------ */

const view = (state, { updateProperties, dispatch }) => {
	const { title, items, onLabel, offLabel, showStateText } = state.properties;
	const list = Array.isArray(items) ? items : [];

	const toggle = (i) => {
		const next = list.map((it, idx) => (idx === i ? { ...it, on: !it.on } : it));
		updateProperties({ items: next });
		const it = next[i];
		dispatch('TOGGLE_CHANGED', { index: i, label: it.label, on: !!it.on });
	};

	return (
		<div className="tc-card">
			{title ? <div className="tc-title">{title}</div> : null}
			<div className="tc-list">
				{list.map((it, i) => {
					const on = !!it.on;
					return (
						<div className="tc-row">
							<span className="tc-label">
								{it.label}
								{it.required ? <span className="tc-req">*</span> : null}
							</span>
							<span className="tc-control">
								<button
									type="button"
									className={`tc-switch${on ? ' tc-switch--on' : ''}`}
									role="switch"
									aria-checked={String(on)}
									aria-label={it.label}
									on-click={() => toggle(i)}
								>
									<span className="tc-knob"></span>
								</button>
								{showStateText ? <span className="tc-state">{on ? onLabel : offLabel}</span> : null}
							</span>
						</div>
					);
				})}
			</div>
		</div>
	);
};

createCustomElement('x-gegis-library-toggle-card', {
	renderer: { type: snabbdom },
	view,
	styles,
	properties: {
		title: { default: 'Core Property' },
		items: { default: [] },
		onLabel: { default: 'On' },
		offLabel: { default: 'Off' },
		showStateText: { default: true },
	},
});
