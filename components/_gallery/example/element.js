/* DEV-ONLY screenshot harness: renders one of every library component (with its
 * default props) on a single page, each in a clean white frame (id="frame-<tag>"),
 * so the docs catalog can capture element-only screenshots. Not deployed. */
import '@servicenow/now-card/src/now-card';
import '@servicenow/now-card/src/now-card-divider';
import '@servicenow/now-icon/src/now-icon';
import '@servicenow/now-highlighted-value/src/now-highlighted-value';
import '@servicenow/now-toggle/src/now-toggle';
import '@servicenow/now-input/src/now-input';
import '@servicenow/now-dropdown/src/now-dropdown';
import '@servicenow/now-button/src/now-button';
import '@servicenow/now-modal/src/now-modal';

import '../../product-selector/src/x-gegis-library-product-selector';
import '../../selected-product/src/x-gegis-library-selected-product';
import '../../quote-comparison/src/x-gegis-library-quote-comparison';
import '../../quote-action-bar/src/x-gegis-library-quote-action-bar';
import '../../peril-deductibles/src/x-gegis-library-peril-deductibles';
import '../../metric-card/src/x-gegis-library-metric-card';
import '../../collapse/src/x-gegis-library-collapse';
import '../../dynamic-form/src/x-gegis-library-dynamic-form';
import '../../endorsement-card/src/x-gegis-library-endorsement-card';
import '../../extraction-summary/src/x-gegis-library-extraction-summary';
import '../../toggle-card/src/x-gegis-library-toggle-card';

/* Sample props for components whose defaults render empty. */
const QC_VERSIONS = [
	{ header: { title: 'Quote Versions Comparison', option: 'Version 1', status: { label: 'Current', color: 'gray' }, selectable: true }, sections: [{ sectionName: 'Overview', type: 'header_summary', fields: [{ label: 'Effective date', displayType: 'text', formatted: 'Jul 1, 2026' }, { label: 'AI recommended', value: false, displayType: 'tick_cross' }] }, { sectionName: 'Coverage', type: 'coverage', fields: [{ label: 'Property Damage', value: true, displayType: 'tick_cross' }, { label: 'Flood', value: false, displayType: 'tick_cross' }] }, { sectionName: 'Premium', type: 'premium', fields: [{ label: 'Total Annual Premium', displayType: 'currency_bold', isAggregation: true, formatted: '$45,100' }] }], actions: [{ label: 'Select', style: 'primary' }] },
	{ header: { option: 'Version 2', status: { label: 'Recommended', color: 'green' }, selectable: true }, sections: [{ sectionName: 'Overview', type: 'header_summary', fields: [{ label: 'Effective date', displayType: 'text', formatted: 'Jul 1, 2026' }, { label: 'AI recommended', value: true, displayType: 'tick_cross' }] }, { sectionName: 'Coverage', type: 'coverage', fields: [{ label: 'Property Damage', value: true, displayType: 'tick_cross' }, { label: 'Flood', value: true, displayType: 'tick_cross' }] }, { sectionName: 'Premium', type: 'premium', fields: [{ label: 'Total Annual Premium', displayType: 'currency_bold', isAggregation: true, formatted: '$51,000', trend: { direction: 'increase', vsBaseline: { formatted: '+$5,900', color: 'red' } } }] }], actions: [{ label: 'Select', style: 'primary' }] },
];
const DF_SECTIONS = [
	{ sectionName: 'Insured details', fields: [
		{ label: 'Number',         name: 'number',    type: 'text',      readonly: true, value: 'CS0001007' },
		{ label: 'Account',        name: 'account',   type: 'reference', value: '' },
		{ label: 'Contact',        name: 'contact',   type: 'reference', value: '' },
		{ label: 'Opened at',      name: 'opened_at', type: 'datetime',  value: '2026-05-11T21:18' },
		{ label: 'State',          name: 'state',     type: 'select',    options: [{ label: 'New', value: '1' }, { label: 'In Progress', value: '2' }, { label: 'Closed', value: '3' }], value: '1' },
		{ label: 'Priority',       name: 'priority',  type: 'select',    options: [{ label: '1 - Critical', value: '1' }, { label: '2 - High', value: '2' }, { label: '3 - Moderate', value: '3' }, { label: '4 - Low', value: '4' }], value: '4' },
		{ label: 'Effective date', name: 'eff',       type: 'date',      value: '2026-07-01' },
		{ label: 'Active',         name: 'active',    type: 'boolean',   value: true },
	] },
];
const DF_UI_ACTIONS = [
	{ label: 'Update',       name: 'update',       variant: 'primary'   },
	{ label: 'Assign to me', name: 'assign_to_me', variant: 'secondary' },
	{ label: 'Cancel',       name: 'cancel',       variant: 'tertiary'  },
];
const TC_ITEMS = [
	{ label: 'Property Damage', on: true, required: true },
	{ label: 'Business Interruption', on: true },
	{ label: 'Flood', on: false },
	{ label: 'Cyber Liability', on: false },
];

const ITEMS = [
	['x-gegis-library-product-selector', 560],
	['x-gegis-library-selected-product', 780],
	['x-gegis-library-quote-comparison', 960, { versions: QC_VERSIONS }],
	['x-gegis-library-quote-action-bar', 820],
	['x-gegis-library-peril-deductibles', 780],
	['x-gegis-library-metric-card', 380],
	['x-gegis-library-collapse', 640, { expanded: true }],
	['x-gegis-library-dynamic-form', 680, { sections: DF_SECTIONS, uiActions: DF_UI_ACTIONS }],
	['x-gegis-library-endorsement-card', 640],
	['x-gegis-library-extraction-summary', 860],
	['x-gegis-library-toggle-card', 560, { items: TC_ITEMS }],
];

document.body.style.margin = '0';
const root = document.createElement('div');
root.style.cssText =
	"padding:24px;background:#f4f6f9;font-family:'Lato',-apple-system,sans-serif;display:flex;flex-direction:column;gap:44px;align-items:flex-start;";
document.body.appendChild(root);

ITEMS.forEach(([tag, w, props]) => {
	const frame = document.createElement('div');
	frame.id = 'frame-' + tag;
	frame.style.cssText =
		'width:' + w + 'px;max-width:100%;background:#fff;border:1px solid #e4e8ee;border-radius:12px;padding:20px;box-sizing:border-box;';
	const el = document.createElement(tag);
	if (props) Object.keys(props).forEach((k) => { el[k] = props[k]; });
	frame.appendChild(el);
	root.appendChild(frame);
});
