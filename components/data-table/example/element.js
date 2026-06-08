import '../src/x-gegis-library-data-table';
/* Local preview ONLY: pull the now-* controls so the playground can render them.
 * These imports live in the `example` (develop) entry — they are NOT in src/, so
 * the deployed bundle never imports now-* (the instance supplies the real Horizon
 * versions). Locally you'll see the legacy (Rome-era) styling; validate the true
 * Horizon look on the instance. See [memory: do-not-bundle-now-star-use-horizon].
 *
 * NOTE: some Horizon controls can't be previewed locally and render only on the
 * instance (which supplies the real Horizon versions):
 *   - now-button-iconic is NOT published to public npm → the per-row action icons
 *     and the drawer close button stay blank locally.
 *   - the public-npm now-select (Rome-era) SCSS fails to compile in the dev harness
 *     ("Undefined operation … * var(...)"), so it is NOT imported here → the column
 *     operator pickers and the group-by selector stay blank locally.
 * Both are declared in now-ui.json innerComponents and work on the instance.
 * Everything else previews. */
import '@servicenow/now-button';
import '@servicenow/now-icon';
import '@servicenow/now-input';
import '@servicenow/now-dropdown';
import '@servicenow/now-highlighted-value';
import '@servicenow/now-loader';
import '@servicenow/now-pagination-control';
import nowUi from '../now-ui.json';
import { mountPlayground } from './playground';

/* This component talks to the instance Table API to load records, so it only
 * populates when served against the target instance. Run:
 *
 *     npm run develop:au
 *
 * and set a real table + query below to see it filled in. */
const el = mountPlayground(nowUi);
if (el) {
	el.table = 'incident';
	el.heading = 'Incidents';
	el.query = 'active=true';
	el.orderBy = 'sys_updated_on';
	el.orderDescending = true;
	el.fields = 'number,short_description,state,priority,assigned_to,sys_updated_on';
	el.labels = 'Number,Short Description,Status,Priority,Assigned To,Last Modified';
	el.pageSize = 5;
	el.itemLabel = 'incidents';
	el.highlightedValueFields = 'state';
	el.wrapAtChars = 40;
	/* showcase the new features */
	el.showGlobalSearch = true;
	el.showColumnFilters = true;
	el.showQuery = true;
	el.showDropdown = true;
	el.dropdownItems = '[{"id":"export","label":"Export"},{"id":"refresh","label":"Refresh"}]';
	el.enableSort = true;
	el.enableGroupBy = true;
	el.enableReorder = true;
	el.enableResize = true;
	el.zebra = true;
	el.actionColumnPosition = 'sticky';
	el.enableReferenceLinks = true;
	el.referenceOpenIn = 'newTab';
	el.rowClickAction = 'expand';
	el.enableDrawer = true;
	el.showAddNew = true;
	el.customButtons = '[{"id":"approve","label":"Approve","icon":"check-outline"}]';
	el.rowHighlightRules = '[{"field":"priority","op":"is","value":"1","color":"#fde8e8"}]';
}
