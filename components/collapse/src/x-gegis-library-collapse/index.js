import { createCustomElement } from '@servicenow/ui-core';
import snabbdom from '@servicenow/ui-renderer-snabbdom';
import styles from './styles.scss';

/* ------------------------------------------------------------------ *
 * x-gegis-library-collapse
 * A fully custom expand/collapse (accordion) panel for ServiceNow
 * Next Experience.
 *
 * Per SERVICENOW_CUSTOM_COMPONENT_DEV_RULES.md §1/§3:
 *   This is a CUSTOM-FROM-SCRATCH component (justified below). The Horizon
 *   design system DOES ship `now-collapse` and `now-accordion`, but:
 *     - `now-accordion` is NOT available in UI Builder (its own docs say so:
 *       "available ... when creating custom components. It's not included in
 *       UI Builder"), and
 *     - `now-collapse` is a behavior utility that requires a separate collapse
 *       trigger and a host container; it has no self-contained header/label.
 *   A single, self-contained, UI-Builder-droppable collapsible panel with its
 *   own header is therefore built here from owned markup. It deliberately uses
 *   ZERO `now-*` dependencies, so it cannot hit the bundling / `process` /
 *   icon-library issues that affect composed components, and it themes purely
 *   through Now design tokens (--now-color--*, --now-font-family).
 *
 * Internal open/closed state lives in component state (`state.open`), seeded
 * from the `expanded` property. Verified APIs: view(state,{updateState,
 * dispatch}); config key `state` = initial state; on-click handlers;
 * class={{...}} conditional classes.
 * ------------------------------------------------------------------ */

/* The chevron is drawn in pure CSS (a rotated bordered box) — deliberately NOT
 * an inline <svg>. The ServiceNow snabbdom JSX renderer mishandles SVG (its
 * props module tries to assign the read-only SVGElement.className, throwing
 * "Cannot set property className of #<SVGElement>"); now-icon itself avoids JSX
 * for SVG for the same reason. CSS has zero such risk. */
const TriggerIcon = (triggerIcon, open) => {
	if (triggerIcon === 'plusminus') {
		return (
			<span className="cp-plusminus" aria-hidden="true">
				{open ? '−' : '+'}
			</span>
		);
	}
	return (
		<span
			className={`cp-chevron${open ? ' cp-chevron--open' : ''}`}
			aria-hidden="true"
		></span>
	);
};

const view = (state, { updateProperties, dispatch }) => {
	const { headingText, bodyText, triggerIcon, iconPosition, bordered, disabled, expanded, contentHeight, contentSizing } =
		state.properties;

	/* Open/closed lives in the `expanded` property itself (toggled via
	 * updateProperties). The ui-core config schema does not allow a `state`
	 * key, so we deliberately keep no separate internal state. */
	const open = Boolean(expanded);
	const contentId = `${state.componentId}-content`;
	const iconLeft = iconPosition === 'left';

	const toggle = () => {
		if (disabled) return;
		const next = !open;
		updateProperties({ expanded: next });
		dispatch('COLLAPSE_TOGGLED', { expanded: next, heading: headingText });
	};

	const icon = <span className="cp-trigger">{TriggerIcon(triggerIcon, open)}</span>;

	/* Embedded components that size to their parent (e.g. a Playbook, which is
	 * height:100% internally) won't render in a pure auto-height container —
	 * they collapse to ~0. Two modes:
	 *   grow  → contentHeight is a MIN floor; the area grows taller with the
	 *           content and the page scrolls. (default; for playbooks)
	 *   fixed → contentHeight is an exact height; the area scrolls inside. */
	const heightVal = contentHeight && String(contentHeight).trim();
	const isFixed = contentSizing === 'fixed';
	let contentStyle = {};
	if (heightVal) contentStyle = isFixed ? { height: heightVal } : { minHeight: heightVal };

	const panelClass =
		'cp-panel' +
		(bordered ? ' cp-panel--bordered' : '') +
		(open ? ' cp-panel--open' : '') +
		(disabled ? ' cp-panel--disabled' : '') +
		(isFixed ? ' cp-panel--fixed-height' : ' cp-panel--grow');
	const headerClass = 'cp-header' + (iconLeft ? ' cp-header--icon-left' : '');

	return (
		<div className={panelClass}>
			<button
				type="button"
				className={headerClass}
				on-click={toggle}
				aria-expanded={String(open)}
				aria-controls={contentId}
				aria-disabled={String(disabled)}
				tabindex={disabled ? '-1' : '0'}
				disabled={disabled}
			>
				{iconLeft ? icon : null}
				<span className="cp-heading">{headingText}</span>
				{iconLeft ? null : icon}
			</button>
			<div
				id={contentId}
				className="cp-content"
				role="region"
				aria-hidden={String(!open)}
				hidden={!open}
			>
				<div className="cp-content-inner" style={contentStyle}>
					{/* Named slot = a UI Builder drop zone. Drop your playbook (or any
					 * components) here in UI Builder. bodyText is the fallback shown
					 * only when the slot is empty (e.g. in local preview). */}
					<slot name="content">
						{bodyText ? <div className="cp-bodytext">{bodyText}</div> : null}
					</slot>
				</div>
			</div>
		</div>
	);
};

createCustomElement('x-gegis-library-collapse', {
	renderer: { type: snabbdom },
	view,
	styles,
	properties: {
		headingText: { default: 'Section title' },
		bodyText: {
			default:
				'Place any content here. In UI Builder you can drop other components into this panel’s slot; this text shows when the slot is empty.',
		},
		expanded: { default: false },
		triggerIcon: { default: 'chevron' },
		iconPosition: { default: 'right' },
		bordered: { default: false },
		disabled: { default: false },
		contentHeight: { default: '60vh' },
		contentSizing: { default: 'grow' },
	},
	slots: {
		/* The default-content drop zone. Authors add components (e.g. a playbook)
		 * to this slot in UI Builder. @defaultSlot */
		content: {},
	},
});
