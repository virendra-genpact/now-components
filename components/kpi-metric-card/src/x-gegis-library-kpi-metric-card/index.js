import { createCustomElement, COMPONENT_PROPERTY_CHANGED } from '@servicenow/ui-core';
import snabbdom from '@servicenow/ui-renderer-snabbdom';
import styles from './styles.scss';

/* ------------------------------------------------------------------ *
 * x-gegis-library-kpi-metric-card  (legacy: card-tile-visualization / kpi-metric-card)
 * A KPI tile: title (with optional icon box), a refresh control, a large score, a
 * change badge (↑/↓ + value) or a subtitle, and an optional sub-metrics breakdown.
 * Has a loading state (the refresh spins until the bound data updates).
 *
 * Composes STANDARD now-card (container/surface) + now-icon (the spinning refresh).
 * §3.1: the deployed entry does NOT import now-* (declared in innerComponents;
 * imported only in example/element.js). now-card uses interaction="none" — it has
 * INNER interactive elements (refresh, sub-metrics) and now-card's interactive overlay
 * button would otherwise swallow their clicks; the card-level click is handled by an
 * on-click on the inner wrapper, with inner buttons calling stopPropagation (matching
 * the legacy behaviour exactly).
 *
 * OWNED markup (documented §5): the icon box, score, change badge and sub-metrics row
 * (no DS components match). Colours are documented hex matching the legacy design; the
 * raw-hex colour props were dropped (defaults unchanged), per the survey-version-item
 * approach. Loading lives in initialState (no `state` config key — [memory]).
 * ------------------------------------------------------------------ */

const VARIANTS = ['positive', 'negative', 'neutral'];

function parseSubMetrics(value) {
	if (typeof value === 'string' && value.trim().startsWith('[')) {
		try {
			return JSON.parse(value);
		} catch (e) {
			return [];
		}
	}
	if (Array.isArray(value)) return value;
	return [];
}

const view = (state, { dispatch, updateState }) => {
	const {
		title,
		singleScore,
		changeValue,
		changeLabel,
		variant,
		showRefresh,
		subtitle,
		showChangeRow,
		showArrow,
		showIcon,
		iconContent,
		subMetricsJson,
	} = state.properties;

	const loading = state.loading || false;
	const safeVariant = VARIANTS.includes(variant) ? variant : 'neutral';
	const arrow = safeVariant === 'positive' ? '↑' : safeVariant === 'negative' ? '↓' : '–';
	const subMetrics = parseSubMetrics(subMetricsJson);

	const handleCardClick = () => {
		if (loading) return;
		dispatch('KPI_CARD_CLICKED', { title, singleScore });
	};

	const handleRefreshClick = (e) => {
		e.stopPropagation();
		if (loading) return;
		updateState({ loading: true });
		dispatch('KPI_REFRESH_REQUESTED', { title });
	};

	const handleSubMetricClick = (metric, index) => (e) => {
		e.stopPropagation();
		dispatch('KPI_SUBMETRIC_CLICKED', { label: metric.label, value: metric.value, index });
	};

	return (
		<now-card className="kpi-card" interaction="none">
			<div className={`card-tile${loading ? ' card-tile--loading' : ''}`} on-click={handleCardClick}>
				<div className={`card-header${showIcon ? ' card-header--with-icon' : ''}`}>
					{showIcon ? <div className="card-icon">{iconContent}</div> : null}
					<div className="card-header-content">
						<span className="card-title">{title}</span>
					</div>
					{showRefresh ? (
						<button
							type="button"
							className={`card-refresh${loading ? ' card-refresh--spinning' : ''}`}
							title="Refresh"
							aria-label="Refresh"
							disabled={loading}
							on-click={handleRefreshClick}
						>
							<now-icon icon="refresh-outline" size="sm" spin={loading}></now-icon>
						</button>
					) : null}
				</div>

				<div className="card-score">{singleScore}</div>

				{showChangeRow && changeValue ? (
					<div className="card-change">
						<span className={`card-badge card-badge--${safeVariant}`}>
							{showArrow ? <span className="card-badge-arrow">{arrow}</span> : null}
							<span className="card-badge-value">{changeValue}</span>
						</span>
						<span className="card-change-label">{changeLabel}</span>
					</div>
				) : null}

				{subtitle ? <div className="card-subtitle">{subtitle}</div> : null}

				{subMetrics.length > 0 ? (
					<div className="card-sub-metrics">
						{subMetrics.map((m, i) => (
							<div className="card-sub-metric" on-click={handleSubMetricClick(m, i)}>
								<span className="card-sub-label">{m.label}</span>
								<span className="card-sub-value">{m.value}</span>
								<span className="card-sub-prev">{m.previousValue}</span>
							</div>
						))}
					</div>
				) : null}
			</div>
		</now-card>
	);
};

createCustomElement('x-gegis-library-kpi-metric-card', {
	renderer: { type: snabbdom },
	view,
	styles,
	initialState: { loading: false },
	properties: {
		title: { default: 'Written Premium' },
		singleScore: { default: '$15.2M' },
		changeValue: { default: '+9.0%' },
		changeLabel: { default: 'vs Last Year' },
		variant: { default: 'positive' },
		showRefresh: { default: true },
		subtitle: { default: '' },
		showChangeRow: { default: true },
		showArrow: { default: true },
		showIcon: { default: false },
		iconContent: { default: '$' },
		subMetricsJson: { default: '' },
	},
	actionHandlers: {
		[COMPONENT_PROPERTY_CHANGED]: ({ action, updateState }) => {
			const { name } = action.payload;
			if (['singleScore', 'changeValue', 'changeLabel', 'variant'].includes(name)) {
				updateState({ loading: false });
			}
		},
	},
});
