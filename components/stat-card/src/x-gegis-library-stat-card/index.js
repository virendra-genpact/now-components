import { createCustomElement } from '@servicenow/ui-core';
import snabbdom from '@servicenow/ui-renderer-snabbdom';
import styles from './styles.scss';

/* ------------------------------------------------------------------ *
 * x-gegis-library-stat-card
 * A compact stat / KPI card: a muted label over a large value, tinted by a
 * severity `variant` (critical / major / moderate / minor / insignificant).
 * Clicking the card emits STAT_CARD_CLICKED.
 *
 * Composes the STANDARD now-card (per §0): container border, surface and the
 * click interaction + a11y. now-card is themed to the legacy flat row (thin
 * hairline, no shadow) via global design tokens at :host (see styles.scss, §5).
 *
 * §3.1 HORIZON-ONLY: the deployed entry does NOT import the now-* source — the
 * instance supplies the Horizon version (declared in now-ui.json `innerComponents`);
 * now-card is imported only in example/element.js for the local playground.
 *
 * OWNED markup (documented §5 exception): the label + large value typography and
 * the severity colour palette (no DS "big number" component matches this). The
 * legacy raw-hex colour props were dropped — the look is driven by the `variant`
 * class palette in styles.scss; defaults are unchanged.
 * ------------------------------------------------------------------ */

const VARIANTS = ['critical', 'major', 'moderate', 'minor', 'insignificant'];

const view = (state, { dispatch }) => {
	const { label, value, variant, useVariantBackground } = state.properties;
	const variantKey = VARIANTS.includes(String(variant || '').toLowerCase().trim())
		? String(variant).toLowerCase().trim()
		: 'critical';
	const tinted = useVariantBackground === true || useVariantBackground === 'true';

	const cardClass =
		`sc-card sc-card--${variantKey}` + (tinted ? ' sc-card--tinted' : '');

	return (
		<now-card
			className={cardClass}
			interaction="click"
			hideShadow={true}
			configAria={{ button: { 'aria-label': label || 'Stat card' } }}
		>
			<div className="sc-label">{label}</div>
			<div className="sc-value">{value}</div>
		</now-card>
	);
};

createCustomElement('x-gegis-library-stat-card', {
	renderer: { type: snabbdom },
	view,
	styles,
	properties: {
		label: { default: 'Total Locations' },
		value: { default: '72' },
		variant: { default: 'critical' },
		useVariantBackground: { default: false },
	},
	actionHandlers: {
		'NOW_CARD#CLICKED': ({ state, dispatch }) => {
			const v = String(state.properties.variant || '').toLowerCase().trim();
			dispatch('STAT_CARD_CLICKED', {
				label: state.properties.label,
				value: state.properties.value,
				variant: VARIANTS.includes(v) ? v : 'critical',
			});
		},
	},
});
