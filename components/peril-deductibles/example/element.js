/* LOCAL PREVIEW ONLY — register the now-* components so the playground renders the
 * controls (toggle, input, dropdown, tag). These imports are NOT in the deployed
 * bundle: `snc ui-component deploy` builds from src/index.js, which deliberately does
 * NOT import now-* (the instance supplies the Horizon versions via now-ui.json
 * `innerComponents`). So this only affects the local `snc develop` playground, where
 * they render in the legacy npm styling — validate the true Horizon look on the
 * instance. */
import '@servicenow/now-card/src/now-card';
import '@servicenow/now-card/src/now-card-divider';
import '@servicenow/now-icon/src/now-icon';
import '@servicenow/now-highlighted-value/src/now-highlighted-value';
import '@servicenow/now-toggle/src/now-toggle';
import '@servicenow/now-input/src/now-input';
import '@servicenow/now-dropdown/src/now-dropdown';

import '../src/x-gegis-library-peril-deductibles';
import nowUi from '../now-ui.json';
import { mountPlayground } from './playground';

/* Auto-generates a live control panel from now-ui.json — see playground.js.
 * Every property and event declared there shows up automatically. */
mountPlayground(nowUi);
