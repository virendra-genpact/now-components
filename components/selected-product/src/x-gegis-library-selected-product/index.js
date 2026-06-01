import { createCustomElement } from '@servicenow/ui-core';
import snabbdom from '@servicenow/ui-renderer-snabbdom';
import styles from './styles.scss';

/* ------------------------------------------------------------------ *
 * x-gegis-library-selected-product
 * A "selected product" summary bar with a Change Product action that opens
 * a confirmation modal before the (irreversible) change is emitted.
 *
 * Composes STANDARD now-* components (per SERVICENOW_CUSTOM_COMPONENT_DEV_RULES.md):
 *   - now-icon ..... the leading shield, the "recommended" star, the modal warning icon
 *   - now-button ... the Change Product action
 *   - now-modal .... the confirmation dialog (header + message slot + footer actions)
 *
 * §3.1 HORIZON-ONLY: this deployed entry does NOT import the now-* source — the
 * instance supplies the Horizon versions (declared in now-ui.json `innerComponents`).
 * The now-* are imported only in example/element.js for the local playground.
 *
 * OWNED markup (documented §5 exception — no DS component matches this product-summary
 * bar): the tinted bar layout + its title/subtitle typography. now-card is a generic
 * container and now-alert is a status banner; neither reproduces this icon + title +
 * star + right-aligned action row, so the bar is owned and styled with design tokens.
 *
 * Interaction (no ambiguous payloads):
 *   - Change button → wrapper on-click opens the modal (local state) + emits REQUESTED.
 *   - Modal footer buttons carry a distinct `clickActionType` (SPB_CONFIRM / SPB_CANCEL)
 *     so each dispatches its own action type — no need to disambiguate by label.
 *   - Modal dismiss (X / Escape) → NOW_MODAL#OPENED_SET → treated as cancel.
 * ------------------------------------------------------------------ */

const isOpen = (state) => state.opened === true;

const view = (state, { dispatch, updateState }) => {
	const p = state.properties;
	const opened = isOpen(state);

	const productText = [p.productPrefix, p.productName].filter(Boolean).join(' ').trim();

	/* Footer buttons render right-to-left (index 0 = rightmost). Continue (primary) on
	 * the right, Cancel (secondary) on the left — matching the reference. */
	const footerActions = [
		{ label: p.confirmLabel, variant: 'primary', clickActionType: 'SPB_CONFIRM' },
		{ label: p.cancelLabel, variant: 'secondary', clickActionType: 'SPB_CANCEL' },
	];

	const openModal = () => {
		updateState({ opened: true });
		dispatch(() => ({ type: 'CHANGE_PRODUCT_REQUESTED', payload: { productName: p.productName } }));
	};

	return (
		<div className="spb">
			<div className="spb-bar">
				{p.icon ? (
					<span className="spb-lead" aria-hidden="true">
						<now-icon icon={p.icon} size="md"></now-icon>
					</span>
				) : null}

				<div className="spb-text">
					<div className="spb-title">
						<span className="spb-name">{productText}</span>
						{p.showStar && p.starIcon ? (
							<now-icon className="spb-star" icon={p.starIcon} size="sm"></now-icon>
						) : null}
					</div>
					{p.subtitle ? <div className="spb-sub">{p.subtitle}</div> : null}
				</div>

				<span className="spb-action" on-click={openModal}>
					<now-button label={p.changeButtonLabel} variant="secondary" size="md"></now-button>
				</span>
			</div>

			<now-modal
				opened={opened}
				manageOpened={true}
				size="sm"
				headerLabel={p.confirmHeader}
				footerActions={footerActions}
				configAria={{ dialog: { 'aria-label': p.confirmHeader } }}
			>
				<div className="spb-confirm">
					{p.confirmIcon ? (
						<span className="spb-warn" aria-hidden="true">
							<now-icon icon={p.confirmIcon} size="lg"></now-icon>
						</span>
					) : null}
					<p className="spb-confirm-msg">{p.confirmMessage}</p>
				</div>
			</now-modal>
		</div>
	);
};

createCustomElement('x-gegis-library-selected-product', {
	renderer: { type: snabbdom },
	view,
	styles,
	initialState: { opened: false },
	properties: {
		productPrefix: { default: 'Product:' },
		productName: { default: 'Commercial Property – Standard Plan' },
		subtitle: { default: 'Base limits and clauses applied from selected product' },
		icon: { default: 'shield-outline' },
		showStar: { default: true },
		starIcon: { default: 'star-fill' },
		changeButtonLabel: { default: 'Change Product' },
		confirmHeader: { default: 'Change Product' },
		confirmMessage: {
			default: 'Changing the product will archive all existing quote options. This action cannot be undone.',
		},
		confirmIcon: { default: 'circle-exclamation-outline' },
		confirmLabel: { default: 'Continue' },
		cancelLabel: { default: 'Cancel' },
	},
	actionHandlers: {
		'SPB_CONFIRM': ({ state, updateState, dispatch }) => {
			updateState({ opened: false });
			dispatch(() => ({ type: 'CHANGE_PRODUCT_CONFIRMED', payload: { productName: state.properties.productName } }));
		},
		'SPB_CANCEL': ({ updateState, dispatch }) => {
			updateState({ opened: false });
			dispatch(() => ({ type: 'CHANGE_PRODUCT_CANCELLED', payload: {} }));
		},
		/* X button / Escape key while the modal is open → treat as cancel. */
		'NOW_MODAL#OPENED_SET': ({ action, updateState, dispatch }) => {
			if (action.payload && action.payload.value === false) {
				updateState({ opened: false });
				dispatch(() => ({ type: 'CHANGE_PRODUCT_CANCELLED', payload: {} }));
			}
		},
	},
});
