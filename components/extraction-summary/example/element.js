import '../src/x-gegis-library-extraction-summary';
import nowUi from '../now-ui.json';
import { mountPlayground } from './playground';

/* Auto-generated control panel from now-ui.json. Because `versions` is a JSON
 * array (which the generic playground can't edit inline), we seed realistic
 * sample data here so the card renders exactly as designed. Switching the
 * dropdown swaps the displayed version. */
const sampleVersions = [
	{
		id: 'v3',
		label: 'V3 – Latest',
		name: 'Extract-V3',
		current: true,
		created: '2026-02-25 16:14:33',
		triggeredBy: 'E005 - Additional Insured Endorsement Request',
		documents: 5,
		totalFields: 23,
		newFields: 6,
		modified: 2,
		lowConfidence: 2,
	},
	{
		id: 'v2',
		label: 'V2',
		name: 'Extract-V2',
		current: false,
		created: '2026-02-20 10:02:11',
		triggeredBy: 'E004 - Policy Update Request',
		documents: 4,
		totalFields: 19,
		newFields: 3,
		modified: 5,
		lowConfidence: 0,
	},
	{
		id: 'v1',
		label: 'V1',
		name: 'Extract-V1',
		current: false,
		created: '2026-02-14 09:30:00',
		triggeredBy: 'E001 - New Submission',
		documents: 3,
		totalFields: 14,
		newFields: 14,
		modified: 0,
		lowConfidence: 1,
	},
];

const el = mountPlayground(nowUi);
if (el) {
	el.versions = sampleVersions;
	el.selectedId = 'v3';
}
