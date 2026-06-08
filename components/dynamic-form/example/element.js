import '../src/x-gegis-library-dynamic-form';
/* Local preview ONLY: pull the now-* controls so the playground can render them.
 * These imports live in the `example` (develop) entry — they are NOT in src/, so
 * the deployed bundle never imports now-* (the instance supplies the real Horizon
 * versions). Locally you'll see the legacy (Rome-era) styling; validate the true
 * Horizon look on the instance. See [memory: do-not-bundle-now-star-use-horizon].
 *
 * NOTE: several controls are intentionally NOT imported here, so they stay blank in
 * local preview and render only on the instance (which supplies the real Horizon
 * versions). All deploy paths are unaffected since src/ imports no now-*. Reasons:
 *   - now-input-password / now-input-url / now-input-phone / now-typeahead-multi /
 *     now-date-time are NOT published to public npm (install 404s) — so password / url /
 *     phone / multi-reference / date fields don't preview locally.
 *   - now-select's public-npm SCSS fails to compile in the dev harness
 *     ("Undefined operation … * var(...)"), so choice/reference selects are left out too.
 *   - now-typeahead is published but left out so the playground doesn't require it.
 * See [memory: do-not-bundle-now-star-use-horizon]. */
import '@servicenow/now-input';
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
