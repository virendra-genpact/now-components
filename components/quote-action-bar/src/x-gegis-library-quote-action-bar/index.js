import { createCustomElement } from '@servicenow/ui-core';
import snabbdom from '@servicenow/ui-renderer-snabbdom';
import styles from './styles.scss';

/* ------------------------------------------------------------------ *
 * x-gegis-library-quote-action-bar
 * Action bar for a set of quote options:
 *   [ Select All ]  X of N selected            [Approve] [Share] [+ Generate]
 *
 * - Select All toggles all options selected / cleared.
 * - Approve Selected + Share to Broker are ENABLED only when >= 1 is selected.
 * - Generate New Option is always enabled.
 *
 * The component just HOLDS the selection (`selected` ids) and EMITS events — it does
 * no data work itself (the page wires the events). Composes the STANDARD now-button
 * (+ its now-icon). Per §3.1 the deployed src does NOT import now-*; the instance
 * supplies the Horizon versions (now-ui.json `innerComponents`); now-* are imported
 * only in example/element.js for local preview.
 *
 * Button identity is explicit: each now-button sits in a wrapper with its own
 * on-click, so there's no need to disambiguate a shared NOW_BUTTON#CLICKED. Approve
 * and Share are also guarded (no-op when nothing is selected) so a click on the
 * disabled button's wrapper area does nothing.
 * ------------------------------------------------------------------ */

const getOptions = (props) =>
	props && props.options && Array.isArray(props.options.items) ? props.options.items : [];

const getSelected = (state, props) => {
	if (Array.isArray(state.selected)) return state.selected;
	return props && props.selectedIds && Array.isArray(props.selectedIds.ids) ? props.selectedIds.ids : [];
};

const view = (state, { dispatch, updateState }) => {
	const p = state.properties;
	const options = getOptions(p);
	const allIds = options.map((o) => o.id);
	const total = options.length;
	const selected = getSelected(state, p);
	const count = selected.length;
	const hasSelection = count > 0;
	const allSelected = total > 0 && count >= total;

	const setSelection = (next) => {
		updateState({ selected: next });
		dispatch(() => ({ type: 'SELECTION_CHANGED', payload: { selected: next, count: next.length } }));
	};
	const onSelectAll = () => setSelection(allSelected ? [] : allIds);
	const onApprove = () => {
		if (!hasSelection) return;
		dispatch(() => ({ type: 'APPROVE_SELECTED', payload: { selected } }));
	};
	const onShare = () => {
		if (!hasSelection) return;
		dispatch(() => ({ type: 'SHARE_TO_BROKER', payload: { selected } }));
	};
	const onGenerate = () => dispatch(() => ({ type: 'GENERATE_NEW_OPTION', payload: {} }));

	return (
		<div className="qab">
			<div className="qab-left">
				<span className="qab-btn" on-click={onSelectAll}>
					<now-button
						label={allSelected && p.deselectAllLabel ? p.deselectAllLabel : p.selectAllLabel}
						variant="secondary"
						size="md"
					></now-button>
				</span>
				{p.showCount ? (
					<span className="qab-count">{count} of {total} selected</span>
				) : null}
			</div>

			<div className="qab-right">
				<span className={hasSelection ? 'qab-btn' : 'qab-btn is-off'} on-click={onApprove}>
					<now-button
						label={p.approveLabel}
						icon={p.approveIcon || undefined}
						variant="tertiary"
						size="md"
						disabled={!hasSelection}
					></now-button>
				</span>
				<span className={hasSelection ? 'qab-btn' : 'qab-btn is-off'} on-click={onShare}>
					<now-button
						label={p.shareLabel}
						icon={p.shareIcon || undefined}
						variant="tertiary"
						size="md"
						disabled={!hasSelection}
					></now-button>
				</span>
				<span className="qab-btn" on-click={onGenerate}>
					<now-button
						label={p.generateLabel}
						icon={p.generateIcon || undefined}
						variant="primary"
						size="md"
					></now-button>
				</span>
			</div>
		</div>
	);
};

createCustomElement('x-gegis-library-quote-action-bar', {
	renderer: { type: snabbdom },
	view,
	styles,
	initialState: { selected: null },
	properties: {
		options: {
			default: {
				items: [
					{ id: 'opt1', label: 'Option 1 v: 1.0' },
					{ id: 'opt2', label: 'Option 2 v: 2.3' },
					{ id: 'opt3', label: 'Option 3 v: 3.0' },
					{ id: 'opt4', label: 'Option 4 v: 1.0' },
				],
			},
		},
		selectedIds: { default: { ids: [] } },
		showCount: { default: true },
		selectAllLabel: { default: 'Select All' },
		deselectAllLabel: { default: 'Deselect All' },
		approveLabel: { default: 'Approve Selected' },
		shareLabel: { default: 'Share to Broker' },
		generateLabel: { default: 'Generate New Option' },
		approveIcon: { default: 'circle-check-outline' },
		shareIcon: { default: 'share-outline' },
		generateIcon: { default: 'plus-outline' },
	},
});
