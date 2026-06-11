import { createCustomElement } from '@servicenow/ui-core';
import snabbdom from '@servicenow/ui-renderer-snabbdom';
import styles from './styles.scss';

/* ------------------------------------------------------------------ *
 * x-gegis-library-risk-survey-table
 * A risk-survey results table driven by columns/rows JSON: a factor column, a score
 * badge (low/medium/high), an AI-sentiments bullet column, and either a chevron
 * affordance or per-row action buttons. Handles loading / empty / error states and an
 * optional href-on-row-click mode.
 *
 * OWNED custom grid (documented §0/§5 exception): the design system ships no now-table
 * primitive, so the responsive CSS-grid table is hand-rolled — same rationale as the
 * library `data-table` component. It composes STANDARD components where they fit:
 *   - now-icon ..... the row chevron
 *   - now-button ... the per-row action buttons (variant primary/secondary)
 *
 * §3.1: the deployed entry does NOT import now-* (declared in innerComponents; imported
 * only in example/element.js). Glyph-free (now-icon used). Colours are documented hex
 * matching the legacy design; the raw-hex colour props (header/factor/sentiment/chevron/
 * background/border/hover) and per-button custom colours were dropped (defaults
 * unchanged), per the survey-version-item approach.
 * ------------------------------------------------------------------ */

const VARIANT_COLORS = ['low', 'medium', 'high'];

const DEFAULT_COLUMNS = [
	{ key: 'factor', header: 'Risk Survey Factors', type: 'text', width: '155px' },
	{ key: 'score', header: 'Score', suffix: '(AI Generated)', type: 'badge', width: '195px', variantKey: 'riskVariant', labelKey: 'riskLabel' },
	{ key: 'sentiments', header: 'Risk Assessment Report Sentiments', suffix: '(AI Generated)', type: 'sentiments' },
];

const DEFAULT_LOADING_MESSAGE = 'Loading…';
const DEFAULT_EMPTY_MESSAGE = 'No data available.';
const DEFAULT_ERROR_MESSAGE = 'Something went wrong.';

function classifyRows(raw) {
	if (raw == null) return { state: 'empty', rows: [] };
	if (Array.isArray(raw)) return raw.length ? { state: 'ready', rows: raw } : { state: 'empty', rows: [] };
	if (typeof raw === 'string') {
		const trimmed = raw.trim();
		if (!trimmed) return { state: 'empty', rows: [] };
		try {
			return classifyRows(JSON.parse(trimmed));
		} catch (_) {
			return { state: 'error', rows: [], message: 'Invalid JSON in Rows Data.' };
		}
	}
	if (typeof raw === 'object') {
		if (raw.loading === true || raw.isLoading === true) {
			return { state: 'loading', rows: [], message: raw.loadingMessage || raw.message };
		}
		const err = raw.error != null ? raw.error : raw.errorMessage;
		if (err) {
			const message = typeof err === 'string' ? err : (err && (err.message || err.toString())) || DEFAULT_ERROR_MESSAGE;
			return { state: 'error', rows: [], message };
		}
		for (const key of ['rows', 'data', 'items', 'results']) {
			if (Array.isArray(raw[key])) {
				const inner = classifyRows(raw[key]);
				if (inner.state === 'empty' && raw.emptyMessage) inner.message = raw.emptyMessage;
				return inner;
			}
		}
	}
	return { state: 'empty', rows: [] };
}

function tryParseJsonArray(raw, fallback) {
	if (raw == null) return { result: fallback, isEmpty: true };
	if (Array.isArray(raw)) return { result: raw, isEmpty: false };
	if (typeof raw !== 'string' || !raw.trim()) return { result: fallback, isEmpty: true };
	try {
		const parsed = JSON.parse(raw.trim());
		if (Array.isArray(parsed)) return { result: parsed, isEmpty: false };
	} catch (_) {
		/* fall through */
	}
	return { result: [], isEmpty: false };
}

const BULLET_PREFIX_RE = /^[-*•·]\s*/;

function parseSentiments(raw) {
	if (!raw) return [];
	if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
	const normalized = String(raw).replace(/\\n/g, '\n');
	return normalized.split('\n').map((s) => s.replace(BULLET_PREFIX_RE, '').trim()).filter(Boolean);
}

function buildGridTemplate(columns, showChevron, actionButtonsCount) {
	const widths = columns.map((col) => col.width || '1fr');
	if (actionButtonsCount > 0) widths.push(`minmax(${actionButtonsCount * 92}px, auto)`);
	else if (showChevron) widths.push('36px');
	return widths.join(' ');
}

function normalizeActionButtons(raw) {
	const { result } = tryParseJsonArray(raw, []);
	return result.filter((b) => b && typeof b === 'object' && b.actionKey && b.label).slice(0, 3);
}

function renderStatePane(rowsState, message) {
	const text =
		message ||
		(rowsState === 'loading' ? DEFAULT_LOADING_MESSAGE : rowsState === 'error' ? DEFAULT_ERROR_MESSAGE : DEFAULT_EMPTY_MESSAGE);
	return (
		<div className={`rst-state rst-state--${rowsState}`} role={rowsState === 'error' ? 'alert' : 'status'}>
			{rowsState === 'loading' ? <span className="rst-state-spinner" /> : null}
			<span className="rst-state-message">{text}</span>
		</div>
	);
}

function renderCellLabel(col) {
	return (
		<span className="rst-cell-label" aria-hidden="true">
			<span className="rst-cell-label-bold">{col.header}</span>
			{col.suffix ? (
				<span className="rst-cell-label-suffix">
					{' '}
					{col.suffix}
				</span>
			) : null}
		</span>
	);
}

function renderCell(col, row, ci) {
	const value = row[col.key];
	const cellClass = `rst-cell rst-col-${ci + 1}`;
	const label = renderCellLabel(col);

	if (col.type === 'badge') {
		const variantKey = row[col.variantKey] || 'medium';
		const safeVariant = VARIANT_COLORS.includes(variantKey) ? variantKey : 'medium';
		const badgeLabel = row[col.labelKey] || '';
		return (
			<div className={cellClass + ' rst-cell--center'}>
				{label}
				<span className={`rst-badge rst-badge--${safeVariant}`}>
					{value} {badgeLabel}
				</span>
			</div>
		);
	}

	if (col.type === 'sentiments') {
		const items = parseSentiments(value);
		return (
			<div className={cellClass}>
				{label}
				<ul className="rst-sentiments">
					{items.map((s) => (
						<li className="rst-sentiment">{s}</li>
					))}
				</ul>
			</div>
		);
	}

	return (
		<div className={cellClass + ' rst-cell--center'}>
			{label}
			<span className="rst-factor-text">{String(value ?? '')}</span>
		</div>
	);
}

const view = (state, { dispatch }) => {
	const { columnsJson, rowsJson, showChevron, enableHref, hrefKey, openInNewWindow, enableActionButtons, actionButtonsJson } =
		state.properties;

	const { result: columns } = tryParseJsonArray(columnsJson, DEFAULT_COLUMNS);
	const { state: rowsState, rows: classifiedRows, message: stateMessage } = classifyRows(rowsJson);
	const finalRows = rowsState === 'ready' ? classifiedRows : [];

	const actionButtons = enableActionButtons ? normalizeActionButtons(actionButtonsJson) : [];
	const hasActionButtons = actionButtons.length > 0;
	const renderChevron = showChevron && !hasActionButtons;
	const gridTemplate = buildGridTemplate(columns, renderChevron, actionButtons.length);

	return (
		<div className="rst-wrapper">
			<div className="rst-header" style={{ gridTemplateColumns: gridTemplate }}>
				{columns.map((col) => (
					<div className="rst-header-cell">
						<span className="rst-header-bold">{col.header}</span>
						{col.suffix ? (
							<span className="rst-header-suffix">
								{' '}
								{col.suffix}
							</span>
						) : null}
					</div>
				))}
				{hasActionButtons ? <div className="rst-header-cell rst-col-actions" /> : null}
				{renderChevron ? <div className="rst-header-cell rst-col-chevron" /> : null}
			</div>

			{rowsState !== 'ready' ? renderStatePane(rowsState, stateMessage) : null}

			{rowsState === 'ready'
				? finalRows.map((row, i) => {
						const isLast = i === finalRows.length - 1;
						const rowClickable = !hasActionButtons;
						const handleRowClick = () => {
							if (!rowClickable) return;
							if (enableHref) {
								const url = hrefKey && row[hrefKey];
								if (url) {
									window.open(
										url,
										openInNewWindow ? '_blank' : '_self',
										openInNewWindow ? 'noopener,noreferrer' : ''
									);
								}
								return;
							}
							dispatch('RISK_SURVEY_ROW_CLICKED', { row, rowIndex: i });
						};

						return (
							<div
								className={'rst-row' + (isLast ? ' rst-row--last' : '') + (rowClickable ? '' : ' rst-row--static')}
								style={{ gridTemplateColumns: gridTemplate }}
								on-click={rowClickable ? handleRowClick : undefined}
							>
								{columns.map((col, ci) => renderCell(col, row, ci))}
								{hasActionButtons ? (
									<div className="rst-cell rst-col-actions">
										{actionButtons.map((btn) => {
											const variant = btn.variant === 'primary' ? 'primary' : 'secondary';
											return (
												<span
													className="rst-action-btn-wrap"
													on-click={(e) => {
														e.stopPropagation();
														dispatch('RISK_SURVEY_CONTEXT_BUTTON_CLICKED', {
															actionKey: btn.actionKey,
															button: btn,
															row,
															rowIndex: i,
														});
													}}
												>
													<now-button label={btn.label} variant={variant} size="sm"></now-button>
												</span>
											);
										})}
									</div>
								) : null}
								{renderChevron ? (
									<div className="rst-cell rst-col-chevron">
										<now-icon icon="chevron-right-outline" size="sm"></now-icon>
									</div>
								) : null}
							</div>
						);
				  })
				: null}
		</div>
	);
};

createCustomElement('x-gegis-library-risk-survey-table', {
	renderer: { type: snabbdom },
	view,
	properties: {
		columnsJson: { default: '' },
		rowsJson: { default: '' },
		showChevron: { default: true },
		enableHref: { default: false },
		hrefKey: { default: 'href' },
		openInNewWindow: { default: true },
		enableActionButtons: { default: false },
		actionButtonsJson: { default: '' },
	},
	styles,
});
