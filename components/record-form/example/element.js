/* Local dev preview — imports the now-* components (Rome-era public npm) so the
 * custom elements are registered in the playground browser.
 * These imports are ONLY here, never in src/ (which uses innerComponents instead). */
import '@servicenow/now-card/src/now-card';
import '@servicenow/now-input/src/now-input';
import '@servicenow/now-button/src/now-button';

import '../src/x-gegis-library-record-form';
import nowUi from '../now-ui.json';
import { mountPlayground } from './playground';

/* Auto-generates a live control panel from now-ui.json.
 * Set table + sysId in the panel to a real record on your connected instance.
 * The dev server proxies /api/* to the instance (configured in now-cli.json). */
mountPlayground(nowUi);
