/* Local dev preview — imports the now-* components (Rome-era public npm) so the
 * custom elements are registered in the playground browser.
 * These imports are ONLY here, never in src/ (which uses innerComponents instead).
 *
 * now-date-time has Public npm: false — it is NOT available on npm.
 * Date fields will render as empty elements locally; validate on the instance. */
import '@servicenow/now-card/src/now-card';
import '@servicenow/now-input/src/now-input';
import '@servicenow/now-button/src/now-button';
import '@servicenow/now-toggle/src/now-toggle';
import '@servicenow/now-dropdown/src/now-dropdown';
import '@servicenow/now-icon/src/now-icon';
import '@servicenow/now-textarea/src/now-textarea';
import '@servicenow/now-rich-text/src/now-rich-text';
import '@servicenow/now-typeahead/src/now-typeahead';
/* now-input-phone, now-input-password, now-input-url — not on public npm.
 * Render as empty in playground; instance supplies them via innerComponents. */

import '../src/x-gegis-library-record-form';
import nowUi from '../now-ui.json';
import { mountPlayground } from './playground';

/* Auto-generates a live control panel from now-ui.json.
 * Set table + sysId in the panel to a real record on your connected instance.
 * The dev server proxies /api/* to the instance (configured in now-cli.json). */
mountPlayground(nowUi);
