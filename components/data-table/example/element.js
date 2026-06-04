import '../src/x-gegis-library-data-table';
/* Local preview ONLY: pull the now-* controls so the playground can render them.
 * These imports live in the `example` (develop) entry — they are NOT in src/, so
 * the deployed bundle never imports now-* (the instance supplies the real Horizon
 * versions). Locally you'll see the legacy (Rome-era) styling; validate the true
 * Horizon look on the instance. See [memory: do-not-bundle-now-star-use-horizon].
 *
 * NOTE: now-button-iconic is NOT published to public npm, so it can't be imported
 * here — the per-row action icons stay blank locally and only render on the
 * instance (which supplies the real Horizon version). Everything else previews. */
import '@servicenow/now-icon';
import '@servicenow/now-loader';
import '@servicenow/now-pagination-control';
import nowUi from '../now-ui.json';
import { mountPlayground } from './playground';

/* This component talks to the instance Table API to load records, so it only
 * populates when served with the target instance. Run:
 *
 *     npm run develop:au
 *
 * and set a real table + query below to see it filled in. */
const el = mountPlayground(nowUi);
if (el) {
	el.table = 'incident';
	el.query = 'active=true';
	el.orderBy = 'sys_updated_on';
	el.orderDescending = true;
	el.fields = 'number,short_description,state,priority,sys_updated_on';
	el.labels = 'Number,Short Description,Status,Priority,Last Modified';
	el.statusField = 'state';
	el.pageSize = 5;
	el.itemLabel = 'incidents';
}
