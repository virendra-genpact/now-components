/* LOCAL PREVIEW ONLY — register the now-* components so the playground renders the
 * card and status icon. These imports are NOT in the deployed bundle: `snc ui-component
 * deploy` builds from src/index.js, which deliberately does NOT import now-* (the
 * instance supplies the Horizon versions via now-ui.json `innerComponents`, per §3.1).
 * Locally they render in the legacy npm styling — validate the true Horizon look on the
 * instance. */
import '@servicenow/now-card/src/now-card';
import '@servicenow/now-icon/src/now-icon';

import '../src/x-gegis-library-survey-version-item';
import nowUi from '../now-ui.json';
import { mountPlayground } from './playground';

/* Auto-generates a live control panel from now-ui.json — see playground.js. */
mountPlayground(nowUi);
