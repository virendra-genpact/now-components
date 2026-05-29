import { createCustomElement } from '@servicenow/ui-core';
import snabbdom from '@servicenow/ui-renderer-snabbdom';
import '@servicenow/now-card/src/now-card';
import '@servicenow/now-icon/src/now-icon';
import styles from './styles.scss';

/* ------------------------------------------------------------------ *
 * x-gegis-library-product-selector
 * A single-select (radio) group of product cards for Next Experience.
 *
 * Per SERVICENOW_CUSTOM_COMPONENT_DEV_RULES.md §0, each option is a standard
 * **now-card** (container) and the checkmarks / pill icon are **now-icon**.
 * Documented §5 exceptions (no standard component fits): the radio dot (no
 * hollow-circle glyph) and the pill (now-highlighted-value renders a flat
 * rectangle with no settable radius/padding) are owned + styled. The radio-group
 * roles, selection, and title/subtitle/bullet text are managed/owned here.
 *
 * Configure via the `options` array; the selected option id is `value`.
 * ------------------------------------------------------------------ */

const parseOptions = (raw) => {
	let arr = raw;
	if (typeof raw === 'string') {
		try { arr = JSON.parse(raw); } catch (e) { arr = []; }
	}
	return Array.isArray(arr) ? arr.filter((o) => o && o.id != null) : [];
};

const PILL_TONES = ['info', 'neutral', 'positive', 'warning', 'error'];
const pillTone = (t) => (PILL_TONES.indexOf(t) !== -1 ? t : 'neutral');

const Bullet = (text) => (
	<div className="ps-bullet">
		<now-icon className="ps-check" icon="check-fill" size="sm"></now-icon>
		<span>{text}</span>
	</div>
);

const view = (state, { updateState, dispatch }) => {
	const { options, value, bulletsWhenSelectedOnly } = state.properties;
	const opts = parseOptions(options);
	// Resolve the selected id: a prior in-component selection, else the configured
	// `value` (if it matches an option), else fall back to the FIRST option — so a
	// card (and its bullets) is always selected by default.
	const ids = opts.map((o) => o.id);
	const valid = (id) => (id != null && ids.indexOf(id) !== -1 ? id : null);
	const effective = valid(state.selectedId) || valid(value) || (opts[0] && opts[0].id);

	const select = (id) => {
		if (id === effective) return;
		updateState({ selectedId: id });
		dispatch('PRODUCT_SELECTED', { value: id });
	};

	return (
		<div className="ps-group" role="radiogroup">
			{opts.map((o) => {
				const sel = o.id === effective;
				const showDetails = !bulletsWhenSelectedOnly || sel;
				const bullets = Array.isArray(o.bullets) ? o.bullets.filter(Boolean) : [];
				return (
					<now-card className={`ps-card${sel ? ' ps-card--sel' : ''}`} interaction="none">
						<div
							className="ps-row"
							role="radio"
							aria-checked={sel ? 'true' : 'false'}
							tabindex="0"
							on-click={() => select(o.id)}
							on-keydown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(o.id); }
							}}
						>
							<span className="ps-radio" aria-hidden="true"></span>
							<div className="ps-main">
								<div className="ps-head">
									<span className="ps-title">{o.title}</span>
									{o.pill ? (
										<span className={`ps-pill ps-pill--${pillTone(o.pillTone)}`}>
											{o.pillIcon ? <now-icon className="ps-pill-icon" icon={o.pillIcon} size="sm"></now-icon> : null}
											<span>{o.pill}</span>
										</span>
									) : null}
								</div>
								{showDetails && (o.subtitle || bullets.length) ? (
									<div className="ps-details">
										{o.subtitle ? <div className="ps-subtitle">{o.subtitle}</div> : null}
										{bullets.map((b) => Bullet(b))}
									</div>
								) : null}
							</div>
						</div>
					</now-card>
				);
			})}
		</div>
	);
};

createCustomElement('x-gegis-library-product-selector', {
	renderer: { type: snabbdom },
	view,
	styles,
	initialState: { selectedId: null },
	properties: {
		/* Array of product options. Each: { id, title, subtitle, bullets:[],
		 * pill, pillTone: info|neutral|positive|warning|error, pillIcon }. */
		options: {
			default: [
				{
					id: 'commercial',
					title: 'Commercial Property – Standard Plan',
					pill: 'AI Recommended',
					pillTone: 'info',
					subtitle: 'Why we recommend:',
					bullets: [
						'Matches industry: Manufacturing',
						'Covers key risks: Fire, Machinery',
						'Within underwriting guidelines',
						'Balanced premium vs coverage',
					],
				},
				{ id: 'flood', title: 'Flood Insurance', pill: 'Higher Protection', pillTone: 'neutral', bullets: [] },
				{ id: 'business', title: 'Business Interruption', pill: 'Lower Premium', pillTone: 'neutral', bullets: [] },
			],
		},
		/* Selected option id. Empty / unmatched → the first option is selected. */
		value: { default: '' },
		/* When true, the subtitle + bullets show only for the selected card. */
		bulletsWhenSelectedOnly: { default: true },
	},
	actionHandlers: {},
});
