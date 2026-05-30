import { createCustomElement } from '@servicenow/ui-core';
import snabbdom from '@servicenow/ui-renderer-snabbdom';
import styles from './styles.scss';

/* ------------------------------------------------------------------ *
 * x-gegis-library-uw-guideline-score
 * Underwriting guideline score summary bar for Next Experience.
 *
 * FULLY OWNED markup. No now-alert, no now-icon, no library-translate.
 * SVG icons are rendered as JSX <svg> elements (snabbdom handles them
 * natively — no innerHTML hacks). Documented §5 exception.
 * ------------------------------------------------------------------ */

const ICONS = {
	info: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z',
	exclamation: 'M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z',
	success: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',
	help: 'M11 18h2v-2h-2v2zm1-16a10 10 0 100 20 10 10 0 000-20zm0 18a8 8 0 110-16 8 8 0 010 16zM12 6a4 4 0 00-4 4h2a2 2 0 114 0c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5a4 4 0 00-4-4z',
};

const Icon = ({ iconKey, color, size }) => {
	const d = ICONS[iconKey] || ICONS.info;
	const uri = 'data:image/svg+xml,' + encodeURIComponent(
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="${color}"><path d="${d}"/></svg>`
	);
	return <img src={uri} width={size} height={size} aria-hidden="true" style="display:block;flex-shrink:0" />;
};

const RISK = {
	low: { num: '#1a7f4b', pillBg: '#e4f6ec', pillText: '#18794e' },
	medium: { num: '#9a6700', pillBg: '#fdf3e2', pillText: '#9a6700' },
	high: { num: '#c8283c', pillBg: '#fde8ec', pillText: '#c8283c' },
};
const risk = (t) => RISK[t] || RISK.medium;

const STATUS = {
	info: { color: '#1d6fe0', bg: '#eaf2fd', border: '#cfe0fb', iconKey: 'info' },
	warning: { color: '#b5640a', bg: '#fdf6e8', border: '#f3e2bd', iconKey: 'exclamation' },
	error: { color: '#c8283c', bg: '#fdeef0', border: '#f6ccd3', iconKey: 'exclamation' },
	success: { color: '#1a7f4b', bg: '#e9f7ef', border: '#bfe8cf', iconKey: 'success' },
};
const status = (t) => STATUS[t] || STATUS.warning;

const INTERACTIVE = '#2f6fed';

const view = (state) => {
	const p = state.properties;
	const r = risk(p.riskTone);
	const st = status(p.statusType);
	const hasStatus = p.showStatus && (p.statusTitle || p.statusMessage);

	return (
		<div className="uw-bar">
			<div className="uw-col">
				{p.scoreSectionLabel ? <div className="uw-section">{p.scoreSectionLabel}</div> : null}
				<div className="uw-score-row">
					<span className="uw-score-num" style={`color:${r.num}`}>{p.score}</span>
					{p.riskLabel ? (
						<span className="uw-risk-pill" style={`background:${r.pillBg};color:${r.pillText}`}>{p.riskLabel}</span>
					) : null}
				</div>
				{p.methodologyLabel ? (
					<div className="uw-method">
						<span className="uw-method-icon">
							<Icon iconKey="help" color={INTERACTIVE} size={16}></Icon>
						</span>
						<a className="uw-method-link" href={p.methodologyHref || '#'}>{p.methodologyLabel}</a>
					</div>
				) : null}
			</div>

			<div className="uw-sep"></div>

			<div className="uw-col">
				{p.countsSectionLabel ? <div className="uw-section">{p.countsSectionLabel}</div> : null}
				<div className="uw-counts">
					<span className="uw-count"><strong>{p.passCount}</strong>{p.passLabel}</span>
					<span className="uw-count"><strong>{p.failCount}</strong>{p.failLabel}</span>
				</div>
			</div>

			{hasStatus ? <div className="uw-sep"></div> : null}
			{hasStatus ? (
				<div className="uw-alert" style={`background-color:${st.bg};border-color:${st.border}`}>
					<span className="uw-alert-icon">
						<Icon iconKey={st.iconKey} color={st.color} size={18}></Icon>
					</span>
					<div className="uw-alert-body">
						{p.statusTitle ? <div className="uw-alert-title" style={`color:${st.color}`}>{p.statusTitle}</div> : null}
						{p.statusMessage ? <div className="uw-alert-msg">{p.statusMessage}</div> : null}
					</div>
				</div>
			) : null}
		</div>
	);
};

createCustomElement('x-gegis-library-uw-guideline-score', {
	renderer: { type: snabbdom },
	view,
	styles,
	properties: {
		scoreSectionLabel: { default: 'Guidelines Score' },
		score: { default: '8' },
		riskTone: { default: 'low' },
		riskLabel: { default: 'Low Risk' },
		methodologyLabel: { default: 'Score Methodology' },
		methodologyHref: { default: '' },
		countsSectionLabel: { default: 'Criteria Results' },
		passCount: { default: '12' },
		passLabel: { default: 'Pass' },
		failCount: { default: '3' },
		failLabel: { default: 'Fail' },
		showStatus: { default: true },
		statusType: { default: 'warning' },
		statusTitle: { default: 'Review Required – 3 Criteria need attention' },
		statusMessage: { default: 'Manual review required before proceeding' },
	},
	actionHandlers: {},
});
