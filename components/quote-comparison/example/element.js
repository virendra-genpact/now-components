import '../src/x-gegis-library-quote-comparison';
import nowUi from '../now-ui.json';
import { mountPlayground } from './playground';

/* `versions` is a JSON array the generic playground can't edit inline, so we seed
 * three sample versions (v1/v2/v3 — same fields, "3 records from the same table")
 * to demonstrate the column-per-version comparison. */
const v = (option, status, x) => ({
	header: { title: 'Quote Versions Comparison', option, status, selectable: true },
	sections: [
		{
			sectionName: 'Policy Basics',
			type: 'header_summary',
			fields: [
				{ label: 'Authority Check', value: x.authority, displayType: 'tick_cross' },
				{ label: 'Purpose', value: x.purpose, displayType: 'text' },
			],
		},
		{
			sectionName: 'Policy Basics',
			type: 'section',
			fields: [
				{ label: 'Program Type', value: 'Commercial Property', displayType: 'text' },
				{ label: 'Policy Period', value: x.period, displayType: 'date_range' },
				{ label: 'State', value: 'CA', displayType: 'text' },
				{ label: 'Payment Plan', value: 'Annual', displayType: 'text' },
			],
		},
		{
			sectionName: 'Coverage Selection',
			type: 'section',
			fields: [
				{ label: 'Building', value: true, displayType: 'tick_cross' },
				{ label: 'Business Personal Property', value: true, displayType: 'tick_cross' },
				{ label: 'Business Income', value: x.bi, displayType: 'tick_cross' },
				{ label: 'Extra Expense', value: false, displayType: 'tick_cross' },
				{ label: 'Equipment Breakdown', value: x.equip, displayType: 'tick_cross' },
			],
		},
		{
			sectionName: 'TIV & Limits',
			type: 'section',
			fields: [
				{ label: 'Building Limit', value: x.bldg, displayType: 'currency', formatted: x.bldgF },
				{ label: 'BPP Limit', value: 2000000, displayType: 'currency', formatted: '$2,000,000' },
				{ label: 'BI Limit', value: 1000000, displayType: 'currency', formatted: '$1,000,000' },
				{ label: 'Total TIV', value: x.tiv, displayType: 'currency_bold', formatted: x.tivF, isAggregation: true },
			],
		},
		{
			sectionName: 'Causes of Loss Form',
			type: 'section',
			fields: [{ label: 'Form Type', value: x.form, displayType: 'pill', pillColor: 'blue' }],
		},
		{
			sectionName: 'Valuation',
			type: 'section',
			fields: [
				{ label: 'Type', value: 'RCV', displayType: 'text' },
				{ label: 'Coinsurance %', value: x.coins, displayType: 'percentage', formatted: `${x.coins}%` },
			],
		},
		{
			sectionName: 'Premium Breakdown',
			type: 'section',
			fields: [
				{ label: 'Base Premium', value: 120000, displayType: 'currency', formatted: '$120,000' },
				{
					label: 'Estimated Annual Premium',
					value: x.prem,
					displayType: 'currency_bold',
					formatted: x.premF,
					isAggregation: true,
					trend: {
						direction: 'decrease',
						icon: 'arrow_down',
						vsBaseline: { value: x.delta, formatted: `${x.delta}% vs baseline`, color: 'green' },
					},
				},
			],
		},
	],
	actions: [
		{ label: 'View Details', type: 'button', style: 'secondary' },
		{ label: 'Clone', type: 'button', style: 'secondary' },
	],
});

const versions = [
	v('Option 1 v: 1.0', { label: 'Draft', type: 'pill', color: 'gray' }, {
		authority: true, purpose: 'Basic Option', period: '04/23/2026 - 04/23/2027', bi: false, equip: false,
		bldg: 4000000, bldgF: '$4,000,000', tiv: 7000000, tivF: '$7,000,000', form: 'Basic', coins: 90,
		prem: 181000, premF: '$181,000', delta: 0,
	}),
	v('Option 2 v: 2.0', { label: 'In Review', type: 'pill', color: 'orange' }, {
		authority: true, purpose: 'Broad Option', period: '04/23/2026 - 04/23/2027', bi: true, equip: false,
		bldg: 4500000, bldgF: '$4,500,000', tiv: 7500000, tivF: '$7,500,000', form: 'Broad', coins: 80,
		prem: 175000, premF: '$175,000', delta: -2.0,
	}),
	v('Option 3 v: 3.0', { label: 'Broker Approved', type: 'pill', color: 'green' }, {
		authority: true, purpose: 'Balanced Option', period: '04/23/2026 - 04/23/2027', bi: true, equip: false,
		bldg: 5000000, bldgF: '$5,000,000', tiv: 8000000, tivF: '$8,000,000', form: 'Special', coins: 80,
		prem: 172865, premF: '$172,865', delta: -4.5,
	}),
];

const el = mountPlayground(nowUi);
if (el) el.versions = versions;
