import { createCustomElement } from '@servicenow/ui-core';
import snabbdom from '@servicenow/ui-renderer-snabbdom';
import styles from './styles.scss';

/* ------------------------------------------------------------------ *
 * x-gegis-library-alert-banner
 * A tinted status / alert banner with four variants: info, warning, critical and a
 * distinct AI variant (sparkle + label + body). Supports an icon circle, title,
 * timestamp subtitle, detail lines, body text and an optional clickable link.
 *
 * 100% CUSTOM, zero now-* deps (documented §0/§5 exception): now-alert is a
 * fixed-layout status banner and cannot reproduce this design — the tinted icon
 * circle, the AI sparkle variant, the detail lines and the clock subtitle. Like the
 * endorsement-card / collapse components, this is a justified owned component. The
 * look is preserved verbatim from the legacy component.
 *
 * Glyphs are injected as HTML strings via props={{innerHTML}} (the sanctioned non-JSX
 * SVG pattern — JSX <svg> crashes snabbdom; see [memory: snabbdom-no-jsx-svg]).
 * ------------------------------------------------------------------ */

const ICON_INFO =
	'<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" ' +
	'fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
	'<circle cx="12" cy="12" r="10"/>' +
	'<line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';

const ICON_WARNING =
	'<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" ' +
	'fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
	'<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>' +
	'<line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';

const ICON_CRITICAL =
	'<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" ' +
	'fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
	'<circle cx="12" cy="12" r="10"/>' +
	'<line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';

const CLOCK_ICON =
	'<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" ' +
	'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
	'<circle cx="12" cy="12" r="10"/>' +
	'<polyline points="12 6 12 12 16 14"/></svg>';

const ICON_AI =
	'<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor">' +
	'<path d="M12 2 L14.2 9.8 L22 12 L14.2 14.2 L12 22 L9.8 14.2 L2 12 L9.8 9.8 Z"/>' +
	'</svg>';

const ICON_MAP = { info: ICON_INFO, warning: ICON_WARNING, critical: ICON_CRITICAL };
const VARIANTS = ['info', 'warning', 'critical', 'ai'];

const view = (state, { dispatch }) => {
	const {
		variant,
		title,
		showTitle,
		subtitle,
		showSubtitle,
		bodyText,
		showBodyText,
		detailLine1,
		detailLine2,
		showDetailLines,
		linkText,
		showLinkText,
		showIcon,
		aiLabel,
	} = state.properties;

	const safeVariant = VARIANTS.includes(variant) ? variant : 'info';

	const handleLinkClick = () => {
		dispatch('ALERT_BANNER_LINK_CLICKED', { linkText, variant: safeVariant });
	};

	if (safeVariant === 'ai') {
		return (
			<div className="ab-banner ab-banner--ai">
				<p className="ab-ai-body">
					{showIcon ? <span className="ab-ai-spark" props={{ innerHTML: ICON_AI }} /> : null}
					{aiLabel ? (
						<span className="ab-ai-label">
							{aiLabel}
							{' '}
						</span>
					) : null}
					{bodyText}
				</p>
			</div>
		);
	}

	return (
		<div className={'ab-banner ab-banner--' + safeVariant}>
			{showIcon ? <div className="ab-icon" props={{ innerHTML: ICON_MAP[safeVariant] }} /> : null}

			<div className={'ab-content' + (showIcon ? '' : ' ab-content--no-icon')}>
				{showTitle ? <p className="ab-title">{title}</p> : null}

				{showSubtitle ? (
					<p className="ab-subtitle">
						<span className="ab-clock" props={{ innerHTML: CLOCK_ICON }} />
						{subtitle}
					</p>
				) : null}

				{showDetailLines ? (
					<div className="ab-details">
						{detailLine1 ? <p className="ab-detail-line1">{detailLine1}</p> : null}
						{detailLine2 ? <p className="ab-detail-line2">{detailLine2}</p> : null}
					</div>
				) : null}

				{showBodyText ? <p className="ab-body">{bodyText}</p> : null}

				{showLinkText ? (
					<p className="ab-link" on-click={handleLinkClick}>
						{linkText}
					</p>
				) : null}
			</div>
		</div>
	);
};

createCustomElement('x-gegis-library-alert-banner', {
	renderer: { type: snabbdom },
	view,
	styles,
	properties: {
		variant: { default: 'info' },
		title: { default: 'Submission Details' },
		showTitle: { default: true },
		subtitle: { default: 'As of : January 9, 2026 at 3:03 PM' },
		showSubtitle: { default: false },
		bodyText: {
			default: '1 entity requires compliance review. Workflow cannot proceed until all matches are resolved.',
		},
		showBodyText: { default: true },
		detailLine1: { default: 'IronClad Inc.' },
		detailLine2: { default: 'Alt North Avenue, Suite 200, New York, NY 10001' },
		showDetailLines: { default: false },
		linkText: { default: 'Select the record below that best matches this submission information.' },
		showLinkText: { default: false },
		showIcon: { default: true },
		aiLabel: { default: 'AI Quick Assessment:' },
	},
});
