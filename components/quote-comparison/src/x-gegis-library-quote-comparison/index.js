import { createCustomElement } from '@servicenow/ui-core';
import snabbdom from '@servicenow/ui-renderer-snabbdom';
import styles from './styles.scss';

/* ------------------------------------------------------------------ *
 * x-gegis-library-quote-comparison  (v2 — combined action bar + grid)
 *
 * Renders:
 *   ┌─ Action bar ──────────────────────────────────────────────────┐
 *   │  [Select All]  X of N selected   [Approve] [Share] [+Generate]│
 *   └───────────────────────────────────────────────────────────────┘
 *   ┌─ Comparison grid ─────────────────────────────────────────────┐
 *   │  label col │ Option 1 v:1.0 │ Option 2 v:2.3 │ …             │
 *   └───────────────────────────────────────────────────────────────┘
 *
 * Every version MUST supply header.sysId (the record sys_id).
 * All events carry sysId so the page can identify which record to act on.
 *
 * OOB components used:
 *   now-button  → action bar + per-version action buttons
 *   now-icon    → tick/cross/status icons inside cells
 * Both declared in innerComponents; NOT imported in src/.
 * ------------------------------------------------------------------ */

/* ── Helpers ──────────────────────────────────────────────────────── */
const sysIdOf        = (v) => (v.header && (v.header.sysId || v.header.versionId || v.header.id)) || '';
const bodySectionsOf = (v) => ((v && v.sections) || []).filter((s) => s.type !== 'header_summary');
const summaryOf      = (v) => ((v && v.sections) || []).find((s) => s.type === 'header_summary') || null;

/* ── Cell value renderer ──────────────────────────────────────────── */
const renderValue = (field) => {
	if (!field) return null;
	const dt  = field.displayType;
	const val = field.value;
	const text = field.formatted != null ? field.formatted : val != null ? String(val) : '';

	/* ── tick_cross — now-icon OOB ── */
	if (dt === 'tick_cross') {
		return val
			? <span className="qc-icon qc-icon--success"><now-icon icon="circle-check-outline" size="sm" /></span>
			: <span className="qc-icon qc-icon--critical"><now-icon icon="circle-close-outline" size="sm" /></span>;
	}

	/* ── status_text — icon + text (Quote Validity, Authority Check) ── */
	if (dt === 'status_text') {
		const STATUS_ICON = {
			warning:  { icon: 'exclamation-triangle-fill', cls: 'qc-icon--warning' },
			success:  { icon: 'circle-check-outline',      cls: 'qc-icon--success' },
			critical: { icon: 'circle-close-outline',      cls: 'qc-icon--critical' },
		};
		const s = field.status && STATUS_ICON[field.status];
		return (
			<span className={`qc-status-text${s ? ` ${s.cls}` : ''}`}>
				{s ? <now-icon icon={s.icon} size="sm" /> : null}
				<span>{text || String(val || '')}</span>
			</span>
		);
	}

	/* ── pill ── */
	if (dt === 'pill') {
		const color = field.pillColor || 'gray';
		return <span className={`qc-pill qc-pill--${color}`}>{val}</span>;
	}

	/* ── currency_bold / aggregation ── */
	const bold = dt === 'currency_bold' || field.isAggregation;

	let trend = null;
	const t = field.trend;
	if (t && t.direction) {
		const arrow = t.direction === 'increase' ? '▲' : '▼';
		const vb    = t.vsBaseline;
		const tone  = (vb && vb.color) || (t.direction === 'decrease' ? 'green' : 'red');
		trend = (
			<span className={`qc-trend qc-trend--${tone}`}>
				{arrow}{vb && vb.formatted ? ` ${vb.formatted}` : ''}
			</span>
		);
	}

	return (
		<span className={`qc-val${bold ? ' qc-val--bold' : ''}${dt === 'text_truncated' ? ' qc-val--trunc' : ''}`}>
			{text}{trend}
		</span>
	);
};

/* ── View ─────────────────────────────────────────────────────────── */
const view = (state, { dispatch, updateState }) => {
	const {
		versions, title, labelWidth,
		showActionBar, showCount,
		selectAllLabel, deselectAllLabel,
		approveLabel, approveIcon,
		shareLabel, shareIcon,
		generateLabel, generateIcon,
	} = state.properties;

	const list      = Array.isArray(versions) ? versions : [];
	const n         = list.length;
	const allSysIds = list.map(sysIdOf);
	const selected  = Array.isArray(state.selected) ? state.selected : [];
	const count     = selected.length;
	const allSelected  = n > 0 && count >= n;
	const hasSelection = count > 0;

	if (!n) return <div className="qc-empty">No versions to compare.</div>;

	/* ── Selection helpers ── */
	const setSelected = (next) => {
		updateState({ selected: next });
		dispatch('QC2_SELECTION_CHANGED', { selected: next, count: next.length });
	};
	const toggleSysId = (sysId, checked) => {
		const next = checked
			? selected.includes(sysId) ? selected : [...selected, sysId]
			: selected.filter((id) => id !== sysId);
		setSelected(next);
		dispatch('QC2_VERSION_SELECTED', { sysId, checked });
	};

	/* ── Action bar ── */
	const actionBar = showActionBar ? (
		<div className="qab">
			<div className="qab-left">
				<span className="qab-btn" on-click={() => setSelected(allSelected ? [] : allSysIds)}>
					<now-button
						label={allSelected && deselectAllLabel ? deselectAllLabel : (selectAllLabel || 'Select All')}
						variant="secondary" size="md"
					/>
				</span>
				{showCount ? <span className="qab-count">{count} of {n} selected</span> : null}
			</div>
			<div className="qab-right">
				<span className={`qab-btn${!hasSelection ? ' is-off' : ''}`}
					on-click={() => { if (hasSelection) dispatch('QC2_APPROVE_SELECTED', { selected }); }}>
					<now-button label={approveLabel || 'Approve Selected'} icon={approveIcon || undefined}
						variant="tertiary" size="md" disabled={!hasSelection} />
				</span>
				<span className={`qab-btn${!hasSelection ? ' is-off' : ''}`}
					on-click={() => { if (hasSelection) dispatch('QC2_SHARE_TO_BROKER', { selected }); }}>
					<now-button label={shareLabel || 'Share to Broker'} icon={shareIcon || undefined}
						variant="tertiary" size="md" disabled={!hasSelection} />
				</span>
				<span className="qab-btn" on-click={() => dispatch('QC2_GENERATE_NEW_OPTION', {})}>
					<now-button label={generateLabel || '+ Generate New Option'} icon={generateIcon || undefined}
						variant="primary" size="md" />
				</span>
			</div>
		</div>
	) : null;

	/* ── Comparison grid ── */
	const head0     = list[0].header || {};
	const titleText = head0.title || title || 'Quote Versions';
	const summary0  = summaryOf(list[0]);
	const body0     = bodySectionsOf(list[0]);
	const gridStyle = { gridTemplateColumns: `${labelWidth || '200px'} repeat(${n}, minmax(0, 1fr))` };
	const cells     = [];

	/* Title band */
	cells.push(<div className="qc-title">{titleText}</div>);

	/* Version header row */
	cells.push(<div className="qc-headlabel">{summary0 ? summary0.sectionName : ''}</div>);
	list.forEach((v, i) => {
		const h   = v.header || {};
		const sid = sysIdOf(v);
		const st  = h.status;
		const isChecked = selected.includes(sid);
		cells.push(
			<div className="qc-headcell">
				<div className="qc-option">{h.option}</div>
				{st ? <span className={`qc-pill qc-pill--${st.color || 'gray'}`}>{st.label}</span> : null}
				{h.selectable ? (
					<label className="qc-select">
						<input type="checkbox" checked={isChecked}
							on-change={(e) => toggleSysId(sid, !!(e && e.target && e.target.checked))} />
						<span>Select</span>
					</label>
				) : null}
			</div>
		);
	});

	/* header_summary rows */
	if (summary0) {
		(summary0.fields || []).forEach((f, fi) => {
			cells.push(<div className="qc-rowlabel">{f.label}</div>);
			list.forEach((v) => {
				const vf     = ((summaryOf(v) || {}).fields || [])[fi];
				const center = vf && vf.displayType === 'tick_cross';
				cells.push(
					<div className={`qc-cell${center ? ' qc-cell--center' : ''}`}>{renderValue(vf)}</div>
				);
			});
		});
	}

	/* Body sections */
	body0.forEach((sec, si) => {
		cells.push(<div className="qc-band">{sec.sectionName}</div>);
		(sec.fields || []).forEach((f, fi) => {
			const agg = f.isAggregation || f.displayType === 'currency_bold';
			cells.push(
				<div className={`qc-rowlabel${agg ? ' qc-rowlabel--agg' : ''}`}>{f.label}</div>
			);
			list.forEach((v) => {
				const vf     = ((bodySectionsOf(v)[si] || {}).fields || [])[fi];
				const center = vf && (vf.displayType === 'tick_cross' || vf.displayType === 'status_text');
				cells.push(
					<div className={`qc-cell${agg ? ' qc-cell--agg' : ''}${center ? ' qc-cell--center' : ''}`}>
						{renderValue(vf)}
					</div>
				);
			});
		});
	});

	/* Per-version action buttons */
	const acts0 = list[0].actions || [];
	if (acts0.length) {
		cells.push(<div className="qc-rowlabel qc-rowlabel--actions">Actions</div>);
		list.forEach((v, i) => {
			const sid = sysIdOf(v);
			const opt = (v.header || {}).option || '';
			cells.push(
				<div className="qc-cell qc-actions">
					{(v.actions || []).map((a) => (
						<span className="qab-btn" on-click={() =>
							dispatch('QC2_ACTION_CLICKED', { index: i, sysId: sid, option: opt, action: a.key || a.label })
						}>
							<now-button
								label={a.label}
								variant={a.variant || 'secondary'}
								size="sm"
								icon={a.icon || undefined}
								animatedIcon={a.animatedIcon || undefined}
								tooltipContent={a.tooltip || a.label}
								configAria={{ button: { 'aria-label': a.ariaLabel || a.label } }}
							/>
						</span>
					))}
				</div>
			);
		});
	}

	return (
		<div className="qc-root">
			{actionBar}
			<div className="qc-grid" style={gridStyle}>{cells}</div>
		</div>
	);
};

createCustomElement('x-gegis-library-quote-comparison-v2', {
	renderer: { type: snabbdom },
	view,
	styles,
	initialState: { selected: [] },
	properties: {
		versions:         { default: [] },
		title:            { default: 'Quote Versions' },
		labelWidth:       { default: '200px' },
		showActionBar:    { default: true },
		showCount:        { default: true },
		selectAllLabel:   { default: 'Select All' },
		deselectAllLabel: { default: 'Deselect All' },
		approveLabel:     { default: 'Approve Selected' },
		shareLabel:       { default: 'Share to Broker' },
		generateLabel:    { default: '+ Generate New Option' },
		approveIcon:      { default: '' },
		shareIcon:        { default: '' },
		generateIcon:     { default: '' },
	},
});
