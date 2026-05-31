import '../src/x-gegis-library-endorsement-card';
import nowUi from '../now-ui.json';
import { mountPlayground } from './playground';

/* The JSON-array props can't be edited inline by the generic playground, so we
 * seed the first card from the reference. Switch the `actionType` control in the
 * panel (required / add / remove / none) to see all action states live. */
const el = mountPlayground(nowUi);
if (el) {
	el.title = 'Commercial General Liability Coverage';
	el.categoryTags = [
		{ label: 'ISO', color: 'blue' },
		{ label: 'Mandatory', color: 'red' },
	];
	el.description = 'Provides coverage for bodily injury and property damage claims';
	el.metaTags = ['Auto-applied', 'Mandatory'];
	el.actionType = 'required';
}
