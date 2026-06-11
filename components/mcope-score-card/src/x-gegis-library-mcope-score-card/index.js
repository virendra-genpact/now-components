import { createCustomElement } from '@servicenow/ui-core';
import snabbdom from '@servicenow/ui-renderer-snabbdom';
import styles from './styles.scss';

/* ------------------------------------------------------------------ *
 * x-gegis-library-mcope-score-card
 * An MCOPE-analysis score card: a title (with optional "(AI Generated)" suffix),
 * a score/risk badge (low / medium / high), a sentiments label and a configurable
 * bullet list of AI-generated sentiments. Clicking the card emits MCOPE_SCORE_CARD_CLICKED.
 *
 * Composes the STANDARD now-card (per §0) for the container/click/a11y, themed to the
 * legacy flat card via global design tokens (§5). §3.1: the deployed entry does NOT
 * import now-* (declared in innerComponents; imported only in example/element.js).
 *
 * OWNED markup (documented §5 exception): the title/suffix, the pill badge (now-badge
 * is numeric-only), the sentiments label and the bullet list. Severity badge colours
 * are kept as documented hex (matching the legacy design). The legacy raw-hex colour
 * props were dropped (defaults unchanged), per the survey-version-item approach.
 * ------------------------------------------------------------------ */

const VARIANTS = ['low', 'medium', 'high'];
const BULLET_PREFIX_RE = /^[\-\*•·]\s*/;

function parseBullets(raw, delimiter) {
	if (Array.isArray(raw)) {
		if (typeof raw[0] === 'object' && raw[0] !== null) {
			return raw.map((item) => item.text || '').filter(Boolean);
		}
		return raw.filter(Boolean);
	}
	if (typeof raw === 'string') {
		const trimmed = raw.trim();
		if (!trimmed) return [];
		if (trimmed.startsWith('[')) {
			try {
				const parsed = JSON.parse(trimmed);
				if (Array.isArray(parsed)) return parseBullets(parsed, delimiter);
			} catch (_) {
				/* fall through */
			}
		}
		const normalized = trimmed.replace(/\\n/g, '\n');
		const sep = delimiter === 'comma' ? ',' : '\n';
		return normalized
			.split(sep)
			.map((s) => s.replace(BULLET_PREFIX_RE, '').trim())
			.filter(Boolean);
	}
	return [];
}

const view = (state, { dispatch }) => {
	const {
		cardTitle,
		titleSuffix,
		showTitleSuffix,
		scoreValue,
		riskLabel,
		badgeVariant,
		sentimentsLabel,
		showSentimentsLabel,
		bulletPointsJson,
		bulletDelimiter,
		bulletStyle,
	} = state.properties;

	const safeVariant = VARIANTS.includes(badgeVariant) ? badgeVariant : 'medium';
	const bullets = parseBullets(bulletPointsJson, bulletDelimiter);

	return (
		<now-card
			className="msc-card"
			interaction="click"
			hideShadow={true}
			configAria={{ button: { 'aria-label': cardTitle || 'MCOPE score card' } }}
		>
			<div className="msc-header">
				<span className="msc-title">{cardTitle}</span>
				{showTitleSuffix && titleSuffix ? (
					<span className="msc-title-suffix">
						{' '}
						{titleSuffix}
					</span>
				) : null}
			</div>

			<div className="msc-badge-row">
				<span className={`msc-badge msc-badge--${safeVariant}`}>
					{scoreValue} {riskLabel}
				</span>
			</div>

			{showSentimentsLabel && sentimentsLabel ? <p className="msc-sentiments">{sentimentsLabel}</p> : null}

			{bullets.length > 0 ? (
				<ul className={`msc-bullets msc-bullets--${bulletStyle}`}>
					{bullets.map((item) => (
						<li className="msc-bullet">{item}</li>
					))}
				</ul>
			) : null}
		</now-card>
	);
};

createCustomElement('x-gegis-library-mcope-score-card', {
	renderer: { type: snabbdom },
	view,
	styles,
	properties: {
		cardTitle: { default: 'Overall Score Based on MCOPE Analysis' },
		titleSuffix: { default: '(AI Generated)' },
		showTitleSuffix: { default: true },
		scoreValue: { default: '7/10' },
		riskLabel: { default: 'Medium Risk' },
		badgeVariant: { default: 'medium' },
		sentimentsLabel: { default: 'Risk Assessment Report Sentiments (AI Generated)' },
		showSentimentsLabel: { default: true },
		bulletPointsJson: { default: '' },
		bulletDelimiter: { default: 'newline' },
		bulletStyle: { default: 'dash' },
	},
	actionHandlers: {
		'NOW_CARD#CLICKED': ({ state, dispatch }) => {
			const v = state.properties.badgeVariant;
			dispatch('MCOPE_SCORE_CARD_CLICKED', {
				scoreValue: state.properties.scoreValue,
				riskLabel: state.properties.riskLabel,
				badgeVariant: VARIANTS.includes(v) ? v : 'medium',
			});
		},
	},
});
