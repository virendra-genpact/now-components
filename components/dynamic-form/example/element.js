import '../src/x-gegis-library-dynamic-form';
/* Local preview ONLY: pull the now-* controls so the playground can render them.
 * These imports live in the `example` (develop) entry — they are NOT in src/, so
 * the deployed bundle never imports now-* (the instance supplies the real Horizon
 * versions). Locally you'll see the legacy (Rome-era) styling; validate the true
 * Horizon look on the instance. See [memory: do-not-bundle-now-star-use-horizon].
 *
 * NOTE: now-date-time, now-typeahead and now-typeahead-multi are intentionally NOT
 * imported here, so the date/datetime fields and the reference / multi-select pickers
 * stay blank in local preview and only render on the instance (which supplies the real
 * Horizon controls). (now-date-time isn't on public npm; the typeaheads are, but are
 * left out so the playground doesn't require them.) All deploy paths are unaffected
 * since src/ imports no now-*. */
import '@servicenow/now-input';
import '@servicenow/now-input-password';
import '@servicenow/now-input-url';
import '@servicenow/now-input-phone';
import '@servicenow/now-select';
import '@servicenow/now-checkbox';
import '@servicenow/now-toggle';
import '@servicenow/now-textarea';
import '@servicenow/now-button';
import '@servicenow/now-loader';
import nowUi from '../now-ui.json';
import { mountPlayground } from './playground';

/* This component talks to the instance Table API (sys_dictionary, sys_choice,
 * sys_ui_element + the record) to build the form, so it only renders fully when
 * served from / with the target instance. Run with assets from the instance:
 *
 *     npm run develop:au
 *
 * and set a real table + record sys_id below to see it populated. */
const el = mountPlayground(nowUi);
if (el) {
	el.heading = 'Coverage';
	el.subheading = 'Building Coverage';
	el.table = 'incident';
	el.sysId = ''; // paste a real record sys_id here to load it locally
	el.view = '';
	el.readOnly = false;
	el.autosave = false;
	el.applyUiPolicy = true;
	el.showUiActions = true;
	el.uiActionPosition = 'top';
	el.booleanControl = 'toggle';
	el.columns = 3;
	el.saveButtonPosition = 'both';
}
