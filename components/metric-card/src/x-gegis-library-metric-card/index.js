import { createCustomElement } from '@servicenow/ui-core';
import snabbdom from '@servicenow/ui-renderer-snabbdom';
import '@servicenow/now-icon/src/now-icon';
import styles from './styles.scss';

/* ------------------------------------------------------------------ *
 * x-gegis-library-metric-card
 * A production-grade KPI / metric card for ServiceNow Next Experience.
 *
 * Renders a single configurable stat: an icon tile, a heading, a large
 * formatted value, and an optional trend pill (e.g. "↓ 4.2%  MoM").
 *
 * Every field is exposed as a component property so the card can be
 * configured entirely from UI Builder — see now-ui.json for the panel
 * definitions.
 * ------------------------------------------------------------------ */

/* ---- Formatting helpers ---------------------------------------- */

/* Parse a property that may arrive as a string ("25", "-4.2") or a
 * number. Returns a finite Number, or NaN when not parseable. */
const toNumber = (raw) => {
	if (raw === null || raw === undefined || raw === '') return NaN;
	if (typeof raw === 'number') return raw;
	// Strip grouping/symbols a user might paste in (e.g. "1,250" / "$25%").
	const cleaned = String(raw).replace(/[^0-9.\-]/g, '');
	return cleaned === '' ? NaN : Number(cleaned);
};

/* Format the main value according to the chosen `format`. Falls back to
 * the raw string when the value isn't numeric (e.g. "N/A"). */
const formatValue = ({ value, format, decimals, currencySymbol }) => {
	const num = toNumber(value);
	if (Number.isNaN(num)) return value === '' || value == null ? '—' : String(value);

	const places = Math.max(0, Number(decimals) || 0);
	const fixed = num.toLocaleString(undefined, {
		minimumFractionDigits: places,
		maximumFractionDigits: places,
	});

	switch (format) {
		case 'percent':
			return `${fixed}%`;
		case 'currency':
			return `${currencySymbol || ''}${fixed}`;
		case 'number':
			return fixed;
		case 'none':
		default:
			return String(value);
	}
};

/* Resolve trend direction. "auto" derives it from the sign of the delta. */
const resolveDirection = (direction, delta) => {
	if (direction && direction !== 'auto') return direction;
	if (Number.isNaN(delta) || delta === 0) return 'flat';
	return delta > 0 ? 'up' : 'down';
};

/* Map a direction + semantics to a visual tone (good / bad / neutral). */
const resolveTone = (direction, positiveIsGood) => {
	if (direction === 'flat') return 'neutral';
	const isGood = direction === 'up' ? positiveIsGood : !positiveIsGood;
	return isGood ? 'good' : 'bad';
};

const ARROW = { up: '↑', down: '↓', flat: '→' };

/* ---- Sub-views -------------------------------------------------- */

const TrendPill = ({ trendValue, trendDirection, trendPeriod, trendPositiveIsGood, decimals }) => {
	const delta = toNumber(trendValue);
	// No trend configured → render nothing.
	if (Number.isNaN(delta)) return null;

	const direction = resolveDirection(trendDirection, delta);
	const tone = resolveTone(direction, trendPositiveIsGood);
	const places = Math.max(0, Number(decimals) || 0);
	const magnitude = Math.abs(delta).toLocaleString(undefined, {
		minimumFractionDigits: 0,
		maximumFractionDigits: places,
	});

	return (
		<div className="mc-trend">
			<span className={`mc-trend-pill mc--${tone}`}>
				<span className="mc-trend-arrow" aria-hidden="true">{ARROW[direction]}</span>
				<span>{magnitude}%</span>
			</span>
			{trendPeriod ? <span className="mc-trend-period">{trendPeriod}</span> : null}
		</div>
	);
};

/* ---- Root view -------------------------------------------------- */

const view = (state, { dispatch }) => {
	const {
		heading,
		icon,
		iconColor,
		iconBackgroundColor,
		clickable,
	} = state.properties;

	const valueText = formatValue(state.properties);

	const iconStyle = {};
	if (iconColor) iconStyle.color = iconColor;
	if (iconBackgroundColor) iconStyle.backgroundColor = iconBackgroundColor;

	const onActivate = clickable
		? () => dispatch('METRIC_CARD_CLICKED', { heading, value: valueText })
		: undefined;

	return (
		<div
			className={`mc-card${clickable ? ' mc-card--clickable' : ''}`}
			role={clickable ? 'button' : 'group'}
			tabindex={clickable ? '0' : undefined}
			aria-label={heading}
			on-click={onActivate}
			on-keydown={
				clickable
					? (e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								onActivate();
							}
					  }
					: undefined
			}
		>
			{icon ? (
				<div className="mc-icon" style={iconStyle} aria-hidden="true">
					<now-icon icon={icon} size="lg"></now-icon>
				</div>
			) : null}

			<div className="mc-body">
				{heading ? <div className="mc-heading">{heading}</div> : null}
				<div className="mc-value">{valueText}</div>
				{TrendPill(state.properties)}
			</div>
		</div>
	);
};

createCustomElement('x-gegis-library-metric-card', {
	renderer: { type: snabbdom },
	view,
	styles,
	properties: {
		/* Title shown above the value, e.g. "Submissions to Quote Ratio". */
		heading: { default: 'Submissions to Quote Ratio' },
		/* now-icon glyph name rendered in the icon tile (e.g. "chart-line-outline",
		 * "currency-dollar-outline"). Leave empty to hide the tile. */
		icon: { default: 'chart-line-outline' },
		/* Optional icon tile overrides (any CSS color). Empty → theme defaults. */
		iconColor: { default: '' },
		iconBackgroundColor: { default: '' },
		/* The headline metric. Accepts a number or numeric string; formatted per `format`. */
		value: { default: '25' },
		/* percent | currency | number | none */
		format: { default: 'percent' },
		/* Decimal places used for the value and trend magnitude. */
		decimals: { default: 2 },
		/* Symbol prefixed when format === 'currency'. */
		currencySymbol: { default: '$' },
		/* Trend delta. Sign drives "auto" direction; magnitude is shown in the pill.
		 * Empty → the trend pill is hidden. */
		trendValue: { default: '-4.2' },
		/* auto | up | down | flat */
		trendDirection: { default: 'auto' },
		/* Caption beside the pill, e.g. "MoM", "YoY", "vs last week". */
		trendPeriod: { default: 'MoM' },
		/* When true, an upward trend is green (good) and downward is red (bad).
		 * Set false for "lower is better" metrics (cost, churn, latency …). */
		trendPositiveIsGood: { default: true },
		/* When true the whole card is focusable and emits METRIC_CARD_CLICKED. */
		clickable: { default: false },
	},
	actionHandlers: {},
});
