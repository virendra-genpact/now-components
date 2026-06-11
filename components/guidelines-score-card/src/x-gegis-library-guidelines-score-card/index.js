import { createCustomElement } from '@servicenow/ui-core';
import snabbdom from '@servicenow/ui-renderer-snabbdom';
import styles from './styles.scss';

/* ------------------------------------------------------------------ *
 * x-gegis-library-guidelines-score-card
 * A composite card: on the left a guidelines score + risk badge and a pass/fail
 * criteria summary (split by a divider); on the right an embedded review banner.
 *
 * Composes the STANDARD now-card (per §0) as the outer container (border + surface),
 * themed to the legacy look via global design tokens (§5). §3.1: deployed entry does
 * NOT import now-* (declared in innerComponents; imported only in example/element.js).
 *
 * OWNED markup (documented §5 exception): the two-section score/criteria layout, the
 * risk badge, the methodology button and the embedded tinted banner (now-alert can't
 * reproduce the icon-circle banner; the score/criteria layout has no DS equivalent).
 * Glyphs via props={{innerHTML}} (non-JSX SVG). Banner/risk colours are documented hex
 * matching the legacy design. UI preserved verbatim.
 * ------------------------------------------------------------------ */

const ICON_INFO =
	'<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" ' +
	'fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
	'<circle cx="12" cy="12" r="10"/>' +
	'<line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';

/* Legacy quirk preserved: the "warning" banner uses the info glyph. */
const ICON_WARNING = ICON_INFO;

const ICON_CRITICAL =
	'<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" ' +
	'fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
	'<circle cx="12" cy="12" r="10"/>' +
	'<line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';

const ICON_HELP =
	'<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" ' +
	'fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
	'<circle cx="12" cy="12" r="10"/>' +
	'<path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>' +
	'<line x1="12" y1="17" x2="12.01" y2="17"/></svg>';

const BANNER_ICON_MAP = { info: ICON_INFO, warning: ICON_WARNING, critical: ICON_CRITICAL };
const RISKS = ['low', 'medium', 'high'];
const BANNERS = ['info', 'warning', 'critical'];

const view = (state, { dispatch }) => {
	const {
		scoreLabel,
		scoreValue,
		riskLabel,
		riskVariant,
		showScoreMethodology,
		scoreMethodologyLabel,
		criteriaLabel,
		passCount,
		passLabel,
		failCount,
		failLabel,
		showBanner,
		bannerVariant,
		bannerTitle,
		bannerSubtitle,
		showBannerIcon,
		bannerLinkText,
		showBannerLinkText,
	} = state.properties;

	const safeRisk = RISKS.includes(riskVariant) ? riskVariant : 'low';
	const safeBanner = BANNERS.includes(bannerVariant) ? bannerVariant : 'warning';

	const handleMethodologyClick = () => {
		dispatch('GUIDELINES_SCORE_METHODOLOGY_CLICKED', { scoreValue, riskLabel, riskVariant: safeRisk });
	};

	const handleBannerLinkClick = () => {
		dispatch('GUIDELINES_BANNER_LINK_CLICKED', { linkText: bannerLinkText, variant: safeBanner });
	};

	return (
		<now-card className="gsc-card" interaction="none">
			<div className="gsc-inner">
				<div className="gsc-left">
					<div className="gsc-section">
						<p className="gsc-section-label">{scoreLabel}</p>
						<div className="gsc-score-row">
							<span className="gsc-score-value">{scoreValue}</span>
							<span className={'gsc-risk-badge gsc-risk-badge--' + safeRisk}>{riskLabel}</span>
						</div>
						{showScoreMethodology ? (
							<button className="gsc-methodology-btn" on-click={handleMethodologyClick}>
								<span className="gsc-methodology-icon" props={{ innerHTML: ICON_HELP }} />
								{scoreMethodologyLabel}
							</button>
						) : null}
					</div>

					<div className="gsc-divider" />

					<div className="gsc-section">
						<p className="gsc-section-label">{criteriaLabel}</p>
						<div className="gsc-criteria-row">
							<div className="gsc-criteria-item">
								<span className="gsc-criteria-count">{passCount}</span>
								<span className="gsc-criteria-text">{passLabel}</span>
							</div>
							<div className="gsc-criteria-sep" />
							<div className="gsc-criteria-item">
								<span className="gsc-criteria-count">{failCount}</span>
								<span className="gsc-criteria-text">{failLabel}</span>
							</div>
						</div>
					</div>
				</div>

				{showBanner ? (
					<div className={'gsc-banner gsc-banner--' + safeBanner}>
						{showBannerIcon ? (
							<div className="gsc-banner-icon" props={{ innerHTML: BANNER_ICON_MAP[safeBanner] }} />
						) : null}
						<div className={'gsc-banner-body' + (showBannerIcon ? '' : ' gsc-banner-body--no-icon')}>
							<p className="gsc-banner-title">{bannerTitle}</p>
							{bannerSubtitle ? <p className="gsc-banner-subtitle">{bannerSubtitle}</p> : null}
							{showBannerLinkText && bannerLinkText ? (
								<p className="gsc-banner-link" on-click={handleBannerLinkClick}>
									{bannerLinkText}
								</p>
							) : null}
						</div>
					</div>
				) : null}
			</div>
		</now-card>
	);
};

createCustomElement('x-gegis-library-guidelines-score-card', {
	renderer: { type: snabbdom },
	view,
	styles,
	properties: {
		scoreLabel: { default: 'Guidelines Score' },
		scoreValue: { default: 8 },
		riskLabel: { default: 'Low Risk' },
		riskVariant: { default: 'low' },
		showScoreMethodology: { default: true },
		scoreMethodologyLabel: { default: 'Score Methodology' },
		criteriaLabel: { default: 'Criteria Results' },
		passCount: { default: 12 },
		passLabel: { default: 'Pass' },
		failCount: { default: 3 },
		failLabel: { default: 'Fail' },
		showBanner: { default: true },
		bannerVariant: { default: 'warning' },
		bannerTitle: { default: 'Review Required – 3 Criteria need attention' },
		bannerSubtitle: { default: 'Manual review required before proceeding' },
		showBannerIcon: { default: true },
		bannerLinkText: { default: '' },
		showBannerLinkText: { default: false },
	},
});
