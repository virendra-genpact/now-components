import '@servicenow/now-button/src/now-button';
import '@servicenow/now-icon/src/now-icon';

import '../src/x-gegis-library-quote-comparison';
import nowUi from '../now-ui.json';
import { mountPlayground } from './playground';

/* ── Exact pixel-matching test data from design ── */

const ACTIONS = [
	{ key: 'view-details', label: 'View Details', icon: 'eye-outline',       tooltip: 'View quote details',    ariaLabel: 'View quote details' },
	{ key: 'edit',         label: 'Edit',         icon: 'pencil-outline',    tooltip: 'Edit this quote',       ariaLabel: 'Edit this quote' },
	{ key: 'clone',        label: 'Clone',        icon: 'documents-outline', tooltip: 'Clone this quote',      ariaLabel: 'Clone this quote' },
];

const mkVersion = (sysId, option, statusLabel, statusColor, data) => ({
	header: { sysId, option, title: 'Quote Versions', status: { label: statusLabel, color: statusColor }, selectable: true },
	sections: [
		/* ── header_summary: Policy ── */
		{
			sectionName: 'Policy',
			type: 'header_summary',
			fields: [
				{ label: 'Quote Validity',  displayType: 'status_text', value: data.validity,  status: data.validityStatus },
				{ label: 'Authority Check', displayType: 'status_text', value: data.authority, status: data.authorityStatus },
				{ label: 'Purpose',         displayType: 'text',        value: data.purpose },
			],
		},
		/* ── Policy Basics ── */
		{
			sectionName: 'Policy Basics',
			type: 'section',
			fields: [
				{ label: 'Program Type',       displayType: 'text', value: 'Commercial Property' },
				{ label: 'Program Type',       displayType: 'text', value: data.period },
				{ label: 'Program Type',       displayType: 'text', value: 'CA' },
				{ label: 'Program Type',       displayType: 'text', value: data.payment },
			],
		},
		/* ── Coverage Selection ── */
		{
			sectionName: 'Coverage Selection',
			type: 'section',
			fields: [
				{ label: 'Building',                  displayType: 'tick_cross', value: true },
				{ label: 'Business Personal Property', displayType: 'tick_cross', value: true },
				{ label: 'Business Income',            displayType: 'tick_cross', value: true },
				{ label: 'Extra Expense',              displayType: 'tick_cross', value: data.extraExpense },
				{ label: 'Equipment Breakdown',        displayType: 'tick_cross', value: data.equipBreakdown },
			],
		},
		/* ── TIV & Limits ── */
		{
			sectionName: 'TIV & Limits',
			type: 'section',
			fields: [
				{ label: 'Building Limit', displayType: 'text',         formatted: data.bldgLimit },
				{ label: 'BPP Limit',      displayType: 'text',         formatted: data.bppLimit },
				{ label: 'BI Limit',       displayType: 'text',         formatted: data.biLimit },
				{ label: 'Total TIV',      displayType: 'currency_bold', formatted: data.totalTiv, isAggregation: true },
			],
		},
		/* ── Deductibles ── */
		{
			sectionName: 'Deductibles',
			type: 'section',
			fields: [
				{ label: 'All-Peril',   displayType: 'text', formatted: '$25,000' },
				{ label: 'Wind',        displayType: 'text', formatted: data.windDed },
				{ label: 'Flood',       displayType: 'text', formatted: '$100,000' },
				{ label: 'Earthquake',  displayType: 'text', formatted: '$250,000' },
			],
		},
		/* ── Causes of Loss Form (1) ── */
		{
			sectionName: 'Causes of Loss Form',
			type: 'section',
			fields: [
				{ label: 'Form Type', displayType: 'pill', value: 'Special', pillColor: 'blue' },
			],
		},
		/* ── Valuation ── */
		{
			sectionName: 'Valuation',
			type: 'section',
			fields: [
				{ label: 'Type',           displayType: 'text', value: 'RCV' },
				{ label: 'Coinsurance %',  displayType: 'text', value: data.coinsurance },
			],
		},
		/* ── Causes of Loss Form (2) ── */
		{
			sectionName: 'Causes of Loss Form',
			type: 'section',
			fields: [
				{ label: 'Form Type', displayType: 'pill',          value: data.causeFormNum, pillColor: 'gray' },
				{ label: 'Type',      displayType: 'text_truncated', value: 'Ordinance or Law, Floodsdsdssss' },
			],
		},
		/* ── Rating Factors ── */
		{
			sectionName: 'Rating Factorst',
			type: 'section',
			fields: [
				{ label: 'Total SCD %t', displayType: 'text', value: data.scd },
				{ label: 'CAT Load %',   displayType: 'text', value: data.catLoad },
				{ label: 'X-Mod',        displayType: 'text', value: data.xMod },
			],
		},
		/* ── Premium Breakdown ── */
		{
			sectionName: 'Premium Breakdown',
			type: 'section',
			fields: [
				{ label: 'Base Premium',             displayType: 'text',         formatted: data.basePrem },
				{ label: 'Endorsement Premium',       displayType: 'text',         formatted: data.endPrem },
				{ label: 'CAT Load',                  displayType: 'text',         formatted: data.catPrem },
				{ label: 'TRIA',                      displayType: 'text',         formatted: data.tria },
				{ label: 'Taxes & Fees',              displayType: 'text',         formatted: data.taxesFees },
				{ label: 'Estimated Annual Premium',  displayType: 'currency_bold', formatted: data.totalPrem, isAggregation: true },
			],
		},
	],
	actions: ACTIONS,
});

const VERSIONS = [
	mkVersion('opt-001', 'Option 1 v: 1.0', 'Pending Approval', 'gray', {
		validity: 'Expiring in 06 days', validityStatus: 'warning',
		authority: 'Passed',             authorityStatus: 'success',
		purpose: 'Standard Coverage',
		period: '04/23/2026 - 04/23/2027', payment: 'Annually',
		extraExpense: false, equipBreakdown: true,
		bldgLimit: '$5,000,000', bppLimit: '$2,000,000', biLimit: '$1,000,000', totalTiv: '$8,000,000',
		windDed: '$50,000',
		coinsurance: '90%', causeFormNum: '12',
		scd: '15%', catLoad: '2.5%', xMod: '1.1',
		basePrem: '$125,000', endPrem: '$28,000', catPrem: '$15,000', tria: '$3,500', taxesFees: '$8,000',
		totalPrem: '$180,100',
	}),
	mkVersion('opt-002', 'Option 2 v: 2.3', 'Pending Approval', 'gray', {
		validity: 'Expiring in 14 days', validityStatus: 'warning',
		authority: 'Authority Breach',   authorityStatus: 'critical',
		purpose: 'High Coverage',
		period: '04/23/2026 - 04/23/2027', payment: 'Quarterly',
		extraExpense: true, equipBreakdown: true,
		bldgLimit: '$5,000,000', bppLimit: '$2,000,000', biLimit: '$1,500,000', totalTiv: '$8,500,000',
		windDed: '$50,000',
		coinsurance: '90%', causeFormNum: '13',
		scd: '18%', catLoad: '2.8%', xMod: '1.1',
		basePrem: '$128,000', endPrem: '$32,000', catPrem: '$16,500', tria: '$3,500', taxesFees: '$8,375',
		totalPrem: '$187,875',
	}),
	mkVersion('opt-003', 'Option 3 v: 3.0', 'Approved', 'green', {
		validity: 'Expiring in16 days', validityStatus: 'none',
		authority: 'Passed',            authorityStatus: 'success',
		purpose: 'Balanced Option',
		period: '04/23/2026 - 04/23/2027', payment: 'Annually',
		extraExpense: false, equipBreakdown: false,
		bldgLimit: '$5,000,000', bppLimit: '$2,000,000', biLimit: '$1,000,000', totalTiv: '$8,000,000',
		windDed: '$75,000',
		coinsurance: '80%', causeFormNum: '12',
		scd: '15%', catLoad: '2.5%', xMod: '1.1',
		basePrem: '$120,000', endPrem: '$28,000', catPrem: '$15,500', tria: '$3,500', taxesFees: '$7,730',
		totalPrem: '$172,865',
	}),
	mkVersion('opt-004', 'Option 1 v: 1.3', 'Pending Approval', 'gray', {
		validity: 'Expiring in 06 days', validityStatus: 'warning',
		authority: 'Passed',             authorityStatus: 'success',
		purpose: 'High Coverage',
		period: '04/23/2026 - 04/23/2027', payment: 'Monthly',
		extraExpense: true, equipBreakdown: true,
		bldgLimit: '$5,500,000', bppLimit: '$2,200,000', biLimit: '$1,500,000', totalTiv: '$9,200,000',
		windDed: '$75,000',
		coinsurance: '100%', causeFormNum: '18',
		scd: '20%', catLoad: '3.2%', xMod: '1.15',
		basePrem: '$145,000', endPrem: '$42,000', catPrem: '$19,500', tria: '$5,200', taxesFees: '$10,585',
		totalPrem: '$222,285',
	}),
];

const el = mountPlayground(nowUi);
if (el) el.versions = VERSIONS;
