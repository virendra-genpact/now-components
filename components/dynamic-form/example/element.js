import '../src/x-gegis-library-dynamic-form';
/* Local preview ONLY: pull the now-* controls so the playground can render them.
 * These imports live in the `example` (develop) entry — they are NOT in src/, so
 * the deployed bundle never imports now-* (the instance supplies the real Horizon
 * versions). Locally you'll see the legacy (Rome-era) styling; validate the true
 * Horizon look on the instance. See [memory: do-not-bundle-now-star-use-horizon]. */
import '@servicenow/now-input';
import '@servicenow/now-select';
import '@servicenow/now-checkbox';
import '@servicenow/now-textarea';
import '@servicenow/now-date-time';
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
	el.columns = 3;
	el.saveButtonPosition = 'both';
}
