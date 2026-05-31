import '../src/x-gegis-library-dynamic-form';
import nowUi from '../now-ui.json';
import { mountPlayground } from './playground';

/* `sections`/`values` are JSON the generic playground can't edit inline, so we
 * seed the form from the reference (Address & Location, Risk Indicators, Building
 * Details, Occupancy). Selects are editable; auto-derived fields are read-only. */
const ph = 'Selected: CA, NY, TX';
const opts = [
	{ label: 'CA', value: 'CA' },
	{ label: 'NY', value: 'NY' },
	{ label: 'TX', value: 'TX' },
];
const sel = (label, name) => ({ label, name, type: 'select', options: opts, placeholder: ph });
const ro = (label, name) => ({ label, name, type: 'text', readonly: true, placeholder: ph });

const sections = [
	{
		sectionName: 'Address & Location',
		fields: [
			sel('Address', 'address'),
			sel('Mailing Address', 'mailingAddress'),
			ro('City', 'city'),
			ro('State', 'state'),
			ro('Country', 'country'),
			ro('ZIP', 'zip'),
		],
	},
	{
		sectionName: 'Risk Indicators (Auto-derived)',
		fields: [
			ro('Flood Zone', 'floodZone'),
			ro('CAT Zone', 'catZone'),
			ro('FIPS Code', 'fipsCode'),
			ro('Lat/Long', 'latLong'),
		],
	},
	{
		sectionName: 'Building Details',
		fields: [
			sel('Building Owner', 'buildingOwner'),
			sel('Number of Stories', 'numberOfStories'),
			sel('Square Footage', 'squareFootage'),
			sel('Year Built', 'yearBuilt'),
			sel('Year Renovated (conditional)', 'yearRenovated'),
		],
	},
	{
		sectionName: 'Occupancy',
		fields: [sel('Occupancy', 'occupancy')],
	},
];

const el = mountPlayground(nowUi);
if (el) {
	el.sections = sections;
	el.values = {};
}
