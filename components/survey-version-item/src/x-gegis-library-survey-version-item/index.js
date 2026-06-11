import { createCustomElement } from '@servicenow/ui-core';
import snabbdom from '@servicenow/ui-renderer-snabbdom';
import styles from './styles.scss';

/* ------------------------------------------------------------------ *
 * x-gegis-library-survey-version-item
 * A single row in a survey version-history list: a status icon, the version
 * title with an optional "LATEST" badge, and a meta line (created date +
 * trigger reason). Clicking the row emits SURVEY_VERSION_ITEM_CLICKED.
 *
 * Composes STANDARD now-* components (per SERVICENOW_CUSTOM_COMPONENT_DEV_RULES.md §0):
 *   - now-card ..... the row container — gives the border/surface, the click
 *     interaction and its built-in a11y (interaction="click" + configAria).
 *   - now-icon ..... the leading status glyph (completed vs pending).
 *
 * §3.1 HORIZON-ONLY: this deployed entry does NOT import the now-* source — the
 * instance supplies the Horizon versions (declared in now-ui.json `innerComponents`).
 * The now-* are imported only in example/element.js for the local playground.
 *
 * OWNED markup (documented §5 exception):
 *   - the title / meta typography (no DS component reproduces this title-row +
 *     muted meta-line layout), and
 *   - the "LATEST" badge: now-badge is numeric-only and now-pill is a dismissible
 *     filter control — neither models a small static status label. The badge is an
 *     owned <span> whose colour comes from a `badgeColor` choice (token-driven, no
 *     raw hex props), styled in styles.scss.
 *
 * The legacy raw-hex colour properties (iconColor, badgeBackgroundColor, …,
 * backgroundColor, borderColor) were dropped: the card surface/border come from
 * now-card's tokens, the icon colour follows the completed/pending status token,
 * and the badge colour is a token-themed choice — per §5 (no hardcoded hex props).
 * ------------------------------------------------------------------ */

const view = (state) => {
	const {
		itemTitle,
		showLatestBadge,
		latestBadgeLabel,
		badgeColor,
		createdLabel,
		createdDate,
		triggeredByLabel,
		triggeredByValue,
		showStatusIcon,
		isCompleted,
		completedIcon,
		pendingIcon,
		clickable,
		hideShadow,
	} = state.properties;

	const icon = isCompleted ? completedIcon : pendingIcon;
	const statusClass = `svi-status${isCompleted ? ' svi-status--completed' : ' svi-status--pending'}`;

	return (
		<now-card
			className="svi-card"
			interaction={clickable ? 'click' : 'none'}
			hideShadow={hideShadow}
			configAria={clickable ? { button: { 'aria-label': itemTitle || 'Survey version item' } } : undefined}
		>
			<div className="svi-row">
				{showStatusIcon && icon ? (
					<span className={statusClass} aria-hidden="true">
						<now-icon icon={icon} size="md"></now-icon>
					</span>
				) : null}

				<div className="svi-content">
					<div className="svi-title-row">
						<span className="svi-title">{itemTitle}</span>
						{showLatestBadge ? (
							<span className={`svi-badge svi-badge--${badgeColor || 'positive'}`}>{latestBadgeLabel}</span>
						) : null}
					</div>
					<div className="svi-meta">
						<span className="svi-meta-label">{createdLabel}</span>
						<span className="svi-meta-value"> {createdDate}</span>
						<span className="svi-sep"> • </span>
						<span className="svi-meta-label">{triggeredByLabel}</span>
						<span className="svi-meta-value"> {triggeredByValue}</span>
					</div>
				</div>
			</div>
		</now-card>
	);
};

createCustomElement('x-gegis-library-survey-version-item', {
	renderer: { type: snabbdom },
	view,
	styles,
	properties: {
		itemTitle: { default: 'Survey Result -V3' },
		showLatestBadge: { default: true },
		latestBadgeLabel: { default: 'LATEST' },
		badgeColor: { default: 'positive' },
		createdLabel: { default: 'Created:' },
		createdDate: { default: '2026-02-25 16:14:33' },
		triggeredByLabel: { default: 'Triggered by:' },
		triggeredByValue: { default: 'Addition of new property' },
		showStatusIcon: { default: true },
		isCompleted: { default: true },
		completedIcon: { default: 'circle-check-fill' },
		pendingIcon: { default: 'circle-check-outline' },
		clickable: { default: true },
		hideShadow: { default: true },
	},
	actionHandlers: {
		'NOW_CARD#CLICKED': ({ state, dispatch }) => {
			if (!state.properties.clickable) return;
			dispatch('SURVEY_VERSION_ITEM_CLICKED', {
				itemTitle: state.properties.itemTitle,
				createdDate: state.properties.createdDate,
				isCompleted: state.properties.isCompleted,
			});
		},
	},
});
