import '../src/x-gegis-library-toggle-card';
import nowUi from '../now-ui.json';
import { mountPlayground } from './playground';

/* `items` is a JSON array the generic playground can't edit inline, so we seed
 * the "Core Property" card from the reference image. */
const el = mountPlayground(nowUi);
if (el) {
	el.title = 'Core Property';
	el.items = [
		{ label: 'Building', on: true, required: true },
		{ label: 'BPP', on: true, required: false },
		{ label: 'PPOuilding', on: true, required: true },
	];
}
