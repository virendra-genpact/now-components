import '../src/x-gegis-library-peril-deductibles';
import nowUi from '../now-ui.json';
import { mountPlayground } from './playground';

/* Auto-generates a live control panel from now-ui.json — see playground.js.
 * Every property and event declared there shows up automatically. */
mountPlayground(nowUi);
