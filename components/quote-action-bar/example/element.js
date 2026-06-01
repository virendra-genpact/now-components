/* LOCAL PREVIEW ONLY — register the now-* components for the playground. NOT in the
 * deployed bundle: deploy builds from src/index.js, which doesn't import now-* (the
 * instance supplies the Horizon versions via now-ui.json `innerComponents`, per §3.1).
 * Locally they render in legacy npm styling — validate the Horizon look on the instance. */
import '@servicenow/now-icon/src/now-icon';
import '@servicenow/now-button/src/now-button';

import '../src/x-gegis-library-quote-action-bar';
import nowUi from '../now-ui.json';
import { mountPlayground } from './playground';

/* Auto-generates a live control panel from now-ui.json — see playground.js. */
mountPlayground(nowUi);
