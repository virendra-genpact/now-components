import '../src/x-gegis-library-dynamic-form';
import nowUi from '../now-ui.json';
import { mountPlayground } from './playground';

/* This component talks to the instance Table API (sys_dictionary, sys_choice,
 * sys_ui_element + the record) to build the form, so it only renders fully when
 * served from / with the target instance. Run with assets from the instance:
 *
 *     npm run develop:au
 *
 * and set a real table + record sys_id below to see it populated. Without an
 * instance session the HTTP calls won't resolve and you'll see "Loading…". */
const el = mountPlayground(nowUi);
if (el) {
	el.table = 'incident';
	el.sysId = ''; // paste a real incident sys_id here to load it locally
	el.view = '';
	el.readOnly = false;
	el.autosave = false;
	el.columns = 2;
}
