import { createCustomElement } from '@servicenow/ui-core';
import snabbdom from '@servicenow/ui-renderer-snabbdom';
import '@servicenow/now-card/src/now-card';
import '@servicenow/now-card/src/now-card-divider';
import '@servicenow/now-icon/src/now-icon';
import '@servicenow/now-highlighted-value/src/now-highlighted-value';
import '@servicenow/now-toggle/src/now-toggle';
import '@servicenow/now-input/src/now-input';
import '@servicenow/now-dropdown/src/now-dropdown';
import styles from './styles.scss';

/* ------------------------------------------------------------------ *
 * x-gegis-library-peril-deductibles
 * A collapsible "Peril-Specific Deductibles" editor for the Next
 * Experience (UI Builder).
 *
 * Per SERVICENOW_CUSTOM_COMPONENT_DEV_RULES.md §0/§2/§5 — every visual
 * element is a STANDARD now-* component, customized via its properties:
 *   - now-card .................. the rounded, bordered, shadowed container
 *   - now-card-divider .......... the rule under the header
 *   - now-highlighted-value ..... the blue category tag ("Coastal Zone"),
 *                                 color="blue" variant="tertiary" (the DS
 *                                 "colored status/category label")
 *   - now-toggle ................ the on/off override switch
 *   - now-input (type=number) ... the deductible value field
 *   - now-dropdown .............. the unit picker ("% TIV"), select="single"
 *   - now-icon .................. the expand/collapse chevron
 *
 * Picker note: now-select is the semantic "form choice" component, but its
 * public-npm (Rome-era) source SCSS multiplies a rem by a CSS var() and is not
 * Dart-Sass-compilable in this toolchain (it breaks both `develop` and
 * `deploy`). now-dropdown (select="single") is the next-best STANDARD picker
 * and bundles cleanly; its trigger shows the selected unit label + a caret.
 *
 * OWNED markup (documented §5 exception — no DS component reproduces this
 * specific arrangement): the header bar layout (inline title + override
 * count + chevron, click-to-collapse) and the per-row two-column layout
 * (peril name / required asterisk / default caption on the left, controls
 * on the right) inside a soft "row" surface. These are pure layout +
 * typography with no design-system equivalent; styled in styles.scss using
 * design tokens only. We never pierce a composed component's shadow DOM.
 *
 * Row identity for interaction is carried explicitly — never inferred:
 *   - toggle: a wrapper on-click closure carries row.id
 *   - input : `name` = row.id, returned in the NOW_INPUT#VALUE_SET payload
 *   - unit  : option ids encoded `${row.id}|${unit}`, returned in the
 *             NOW_DROPDOWN#SELECTED_ITEMS_SET payload
 * ------------------------------------------------------------------ */

const DEFAULT_UNITS = [
	{ id: 'pct_tiv', label: '% TIV' },
	{ id: 'amount', label: '$ Amount' },
	{ id: 'pct_limit', label: '% Limit' },
];

/* ---- Selectors over the (object-wrapped) JSON properties -------- *
 * NOTE: the `perils`/`unitOptions` defaults are objects ({ items: [] }),
 * not bare arrays — a top-level ARRAY default for a fieldType:"json"
 * property breaks the production build ("Invalid character in name: 0").  */
const getItems = (props) =>
	props && props.perils && Array.isArray(props.perils.items) ? props.perils.items : [];

const getUnits = (props) => {
	const u = props && props.unitOptions && Array.isArray(props.unitOptions.items) ? props.unitOptions.items : [];
	return u.length ? u : DEFAULT_UNITS;
};

const countOverrides = (items) => items.reduce((n, it) => (it && it.enabled ? n + 1 : n), 0);

const isExpanded = (props) => props.expanded !== false;

/* Encode/decode the per-row select option id so the change payload tells
 * us BOTH which row and which unit, with no ambiguity. */
const optionId = (rowId, unitId) => `${rowId}|${unitId}`;
const decodeOption = (encoded) => {
	const i = String(encoded).indexOf('|');
	return i < 0 ? { id: encoded, unit: '' } : { id: encoded.slice(0, i), unit: encoded.slice(i + 1) };
};

/* ---- One peril row (owned layout; standard now-* controls) ------ */
const PerilRow = (row, units, dispatch) => {
	const enabled = !!row.enabled;
	const unitId = row.unit || (units[0] && units[0].id) || '';
	const items = units.map((u) => ({ id: optionId(row.id, u.id), label: u.label }));

	return (
		<div className={enabled ? 'pd-row' : 'pd-row is-off'}>
			<div className="pd-info">
				<div className="pd-title-line">
					<span className="pd-name">{row.name}</span>
					{row.required ? (
						<span className="pd-required" aria-hidden="true">*</span>
					) : null}
					{row.zone ? (
						<now-highlighted-value
							className="pd-zone"
							label={row.zone}
							color="blue"
							variant="tertiary"
						/>
					) : null}
				</div>
				{row.defaultText ? <div className="pd-default">{row.defaultText}</div> : null}
			</div>

			<div className="pd-controls">
				<span
					className="pd-toggle"
					on-click={() => dispatch(() => ({ type: 'PD_SET_ENABLED', payload: { id: row.id } }))}
				>
					<now-toggle
						checked={enabled}
						configAria={{ switch: { 'aria-label': `Override ${row.name}` } }}
					/>
				</span>

				<now-input
					className="pd-value"
					type="number"
					align="start"
					size="md"
					name={row.id}
					value={row.value === null || row.value === undefined ? '' : String(row.value)}
					disabled={!enabled}
					configAria={{ input: { 'aria-label': `Deductible value for ${row.name}` } }}
				/>

				<now-dropdown
					className="pd-unit"
					size="md"
					variant="secondary"
					select="single"
					items={items}
					selectedItems={[optionId(row.id, unitId)]}
					disabled={!enabled}
					configAria={{
						trigger: { 'aria-label': `Deductible unit for ${row.name}` },
						panel: { 'aria-label': `Deductible units` },
					}}
				/>
			</div>
		</div>
	);
};

/* ---- Root view ------------------------------------------------- */
const view = (state, { dispatch }) => {
	const props = state.properties;
	const items = getItems(props);
	const units = getUnits(props);
	const expanded = isExpanded(props);
	const overrides = countOverrides(items);

	return (
		<now-card className="pd-card">
			<div className="pd-shell">
				<button
					type="button"
					className="pd-header"
					aria-expanded={expanded ? 'true' : 'false'}
					on-click={() => dispatch(() => ({ type: 'PD_TOGGLE_EXPANDED', payload: {} }))}
				>
					<span className="pd-heading">{props.title}</span>
					{props.showOverrideCount && overrides > 0 ? (
						<span className="pd-count">{overrides} {overrides === 1 ? 'override' : 'overrides'} applied</span>
					) : null}
					<span className="pd-spacer" />
					<now-icon
						className={expanded ? 'pd-chevron' : 'pd-chevron is-collapsed'}
						icon="chevron-down-outline"
						size="md"
						aria-hidden="true"
					/>
				</button>

				{expanded ? (
					<div className="pd-body">
						<now-card-divider full-width block-spacing="none" />
						<div className="pd-rows">
							{items.map((row) => PerilRow(row, units, dispatch))}
						</div>
					</div>
				) : null}
			</div>
		</now-card>
	);
};

/* ---- Immutable row update + public event ----------------------- */
const updateRow = ({ state, updateProperties, dispatch }, id, patch) => {
	const items = getItems(state.properties).map((it) => (it.id === id ? { ...it, ...patch } : it));
	updateProperties({ perils: { items } });
	const row = items.find((it) => it.id === id);
	if (row) {
		dispatch('PERIL_DEDUCTIBLE_CHANGED', {
			id: row.id,
			name: row.name,
			enabled: !!row.enabled,
			value: row.value,
			unit: row.unit,
		});
	}
};

createCustomElement('x-gegis-library-peril-deductibles', {
	renderer: { type: snabbdom },
	view,
	styles,
	properties: {
		title: { default: 'Peril-Specific Deductibles' },
		expanded: { default: true },
		showOverrideCount: { default: true },
		unitOptions: { default: { items: DEFAULT_UNITS } },
		perils: {
			default: {
				items: [
					{ id: 'wind', name: 'Wind / Hurricane', required: true, zone: 'Coastal Zone', defaultText: 'Default: 2% of TIV', enabled: true, value: '2', unit: 'pct_tiv' },
					{ id: 'flood', name: 'Flood', required: true, zone: 'Flood Zone A', defaultText: 'Default: 5% of TIV', enabled: true, value: '5', unit: 'pct_tiv' },
					{ id: 'earthquake', name: 'Earthquake', required: false, zone: '', defaultText: 'Default: 10% of TIV', enabled: false, value: '10', unit: 'pct_tiv' },
					{ id: 'hail', name: 'Hail', required: false, zone: '', defaultText: 'Default: 1% of TIV', enabled: true, value: '1', unit: 'pct_tiv' },
				],
			},
		},
	},
	actionHandlers: {
		'PD_TOGGLE_EXPANDED': ({ state, updateProperties }) => {
			updateProperties({ expanded: !isExpanded(state.properties) });
		},
		'PD_SET_ENABLED': (coeffects) => {
			const { id } = coeffects.action.payload;
			const cur = getItems(coeffects.state.properties).find((it) => it.id === id);
			updateRow(coeffects, id, { enabled: !(cur && cur.enabled) });
		},
		'NOW_INPUT#VALUE_SET': (coeffects) => {
			const { name, value } = coeffects.action.payload || {};
			if (!name) return;
			updateRow(coeffects, name, { value });
		},
		'NOW_DROPDOWN#SELECTED_ITEMS_SET': (coeffects) => {
			const val = coeffects.action.payload && coeffects.action.payload.value;
			const raw = Array.isArray(val) ? val[0] : val;
			if (typeof raw !== 'string' || raw.indexOf('|') < 0) return;
			const { id, unit } = decodeOption(raw);
			updateRow(coeffects, id, { unit });
		},
	},
});
