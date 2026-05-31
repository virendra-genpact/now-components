import { createCustomElement } from '@servicenow/ui-core';
import snabbdom from '@servicenow/ui-renderer-snabbdom';
import styles from './styles.scss';

/* ------------------------------------------------------------------ *
 * x-gegis-library-endorsement-card
 * A single endorsement / clause card.
 *
 * Covers all action types via `actionType`:
 *   - required → gray, disabled "Required" button
 *   - remove   → red "× Remove" button (fires ACTION_CLICKED {type:'remove'})
 *   - add      → blue "+ Add" button (fires ACTION_CLICKED {type:'add'})
 *   - none     → no button
 * Plus colored category pills (ISO/Mandatory/Applied/Proprietary…), gray meta
 * tags, description, and a chevron (decorative, or collapsible when enabled).
 *
 * 100% CUSTOM, zero now-* deps. Chevron is pure CSS (no JSX <svg>). Lessons
 * applied: string class names only; no `state` config key (collapse state lives
 * in the `expanded` property, flipped via updateProperties); defensive arrays.
 * ------------------------------------------------------------------ */

const labelOf = (m) => (typeof m === 'string' ? m : m && m.label ? m.label : '');

const defaultActionText = (type) => {
	if (type === 'required') return 'Required';
	if (type === 'add') return '+ Add';
	if (type === 'remove') return '× Remove';
	return '';
};

const view = (state, { updateProperties, dispatch }) => {
	const { title, categoryTags, description, metaTags, actionType, actionLabel, expanded, collapsible } =
		state.properties;
	const cats = Array.isArray(categoryTags) ? categoryTags : [];
	const metas = Array.isArray(metaTags) ? metaTags : [];
	const open = collapsible ? !!expanded : true;

	const toggle = () => {
		if (!collapsible) return;
		updateProperties({ expanded: !expanded });
		dispatch('TOGGLED', { expanded: !expanded });
	};

	const onAction = () => {
		if (actionType === 'required' || actionType === 'none' || !actionType) return;
		dispatch('ACTION_CLICKED', { type: actionType });
	};

	const actText = actionLabel || defaultActionText(actionType);
	const chevron = <span className={`ec-chev${open ? ' ec-chev--open' : ''}`} aria-hidden="true"></span>;

	return (
		<div className="ec-card">
			<div className="ec-head">
				<div className="ec-title">{title}</div>
				{collapsible ? (
					<button
						type="button"
						className="ec-chevbtn"
						aria-expanded={String(open)}
						aria-label="Toggle details"
						on-click={toggle}
					>
						{chevron}
					</button>
				) : (
					chevron
				)}
			</div>

			{open ? (
				<div className="ec-body">
					{cats.length ? (
						<div className="ec-cats">
							{cats.map((c) => (
								<span className={`ec-pill ec-pill--${(c && c.color) || 'gray'}`}>{labelOf(c)}</span>
							))}
						</div>
					) : null}

					{description ? <div className="ec-desc">{description}</div> : null}

					{metas.length ? (
						<div className="ec-metas">
							{metas.map((m) => (
								<span className="ec-meta">{labelOf(m)}</span>
							))}
						</div>
					) : null}

					{actionType && actionType !== 'none' ? (
						<button
							type="button"
							className={`ec-act ec-act--${actionType}`}
							disabled={actionType === 'required'}
							aria-disabled={String(actionType === 'required')}
							on-click={onAction}
						>
							{actText}
						</button>
					) : null}
				</div>
			) : null}
		</div>
	);
};

createCustomElement('x-gegis-library-endorsement-card', {
	renderer: { type: snabbdom },
	view,
	styles,
	properties: {
		title: { default: 'Commercial General Liability Coverage' },
		categoryTags: { default: [] },
		description: { default: '' },
		metaTags: { default: [] },
		actionType: { default: 'required' },
		actionLabel: { default: '' },
		expanded: { default: true },
		collapsible: { default: false },
	},
});
