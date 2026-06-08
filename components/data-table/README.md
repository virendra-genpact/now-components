# Data Table (`x-gegis-library-data-table`)

A configurable record **list / data grid** for ServiceNow Next Experience (UI Builder).
Give it a **table** and a fixed **query**; it loads matching records over the **Table API**
and renders them in a paginated, OOTB-style grid — now with a full set of list features:
global + per-column query building, list/declarative actions, a configurable dropdown,
custom row buttons, highlighted-value & HTML cells, zebra & conditional row highlighting,
click-to-sort, group-by, column reorder/resize, wrap-text, inline editing, reference-cell
links, and a right slide-in **drawer with a droppable slot** (drop a Dynamic Form for
inline Edit / Add-new).

![reference design](../../../docs/data-table.png)

## How it works

- Data is fetched over `@servicenow/ui-effect-http` (`createHttpEffect`) against
  `/api/now/table/:table` with **`batch: false`** (the batched transport mismatches
  version-skewed instances → 503), so the instance session / auth / scope are used
  automatically — no hand-rolled `fetch()`.
- **Lazy, server-side paging:** only the current page's rows are loaded
  (`sysparm_limit` + `sysparm_offset`); the footer total comes from the **`X-Total-Count`**
  response header.
- Records use `sysparm_display_value=all` (each cell carries `value` + `display_value`);
  `sys_id` is always requested. When **clickable reference cells** are on, the response also
  keeps the reference `link` (`sysparm_exclude_reference_link=false`) so each ref cell knows
  its referenced table + sys_id.
- **One server query** is assembled from the fixed filter, the global search, and the
  per-column filters, plus ORDERBY for sort/group — see *Query pipeline* below.

## Query pipeline

The effective `sysparm_query` is a single AND-join:

1. the **fixed filter** (`query`),
2. the **global search** as `123TEXTQUERY321=<term>` — the platform full-text operator,
   which ANDs cleanly with everything (searches the table's indexed columns),
3. the **per-column filters** (`field <op> value`), and
4. `ORDERBY` clauses — the active group field first (if any), then the active sort
   (a clicked header overrides the configured `orderBy`).

Operators offered in the column-filter row: **is** (`=`), **is not** (`!=`),
**contains** (`LIKE`), **starts with** (`STARTSWITH`), **ends with** (`ENDSWITH`),
**in** (`IN`), **not in** (`NOT IN`), **greater than** (`>`), **less than** (`<`),
**is empty** (`ISEMPTY`), **is not empty** (`ISNOTEMPTY`). Turn on **Show query bar** to
see the exact encoded query sent to the server.

**Native-list toolbar chips:** filter, sort and group-by are presented as toolbar chips
(like the platform list). The **Filter** chip shows/hides the per-column filter row
**client-side** (no refetch) and shows the active condition count; the **Sort** chip lists
columns and toggles ascending → descending → off (header clicks do the same); the
**Group by** chip picks the group field. Column headers render bold/dark to match the
native list. **Global search** is a round search icon that opens a **popover** (Search
title, input, Clear) anchored beneath it. The **operator** picker in the filter row is a
`now-dropdown` ("Operator [is ▾]") so its options render as a proper visible menu.

**Record-list header parity:** the heading shows a **record-count badge** (`showCount`) and
a **"Last refreshed …" subtitle** (`showLastRefreshed`) that updates on Refresh. A **leading
filter-toggle icon** column (a funnel; `showFilterIcon`, **no selection checkbox**) shows/hides
the per-column filter row, and a **"More actions" (⋮) menu** (`showMoreActions`) collects
Refresh / Reset / Export plus any configured dropdown items. Each **column header** reveals a
**⋮ actions menu** on hover (`showColumnMenu`) for sort-ascending / sort-descending / filter /
group-by, and shows small **filter / group state icons**. Rows are **compact** with strict
**alternate-row shading** (`zebra`).

**Grouped rows** get a per-group **expand/collapse** toggle and a **per-page count badge**, plus
an **Expand all / Collapse all** control in the footer. (Counts and grouping are within the
loaded page — see limitations.)

**Toolbar list actions:** `Refresh` (reloads the current page), `Reset` (clears search /
column filters / sort / group-by), `Export` (fires the `EXPORT` event with the current
query for the page to run a server export), and `New` (fires `ADD_NEW` / opens the drawer).

**Choice columns** (fields with a `sys_choice` list) automatically get a multi-select
**"Edit filter" / "N values selected"** picker in the filter row (building a
`fieldIN<values>` query), exactly like the native list; all other columns use the
operator + value control. (Choice lists are read from `sys_choice` for the table; choices
inherited from a parent table aren't auto-detected — those columns fall back to
operator + value.)

## Composition (design-system components used)

Per `SERVICENOW_CUSTOM_COMPONENT_DEV_RULES.md` §0 the component composes standard Horizon
components wherever one exists:

| Piece | Component |
| --- | --- |
| Toolbar / list-action / add-new buttons | `now-button` |
| Edit / Duplicate / Delete / custom row icons, drawer close | `now-button-iconic` |
| Global search, column-filter value, inline-edit input | `now-input` |
| Column-filter **operator** picker, inline-edit choice/boolean, choice-column "Edit filter", configurable / More-actions / column-⋮ menus | `now-dropdown` |
| Highlighted-value cells | `now-highlighted-value` |
| Loading state | `now-loader` |
| Pagination | `now-pagination-control` |
| Icons | `now-icon` |

These are declared in `now-ui.json` `innerComponents` and supplied by the **instance** at
runtime — they are **not** imported into the deployed `src/` entry (§3.1). They are imported
only in `example/element.js` for local preview. (`now-button-iconic` is **not** on public
npm, so the per-row action icons render only on the instance, not in local preview.)

### Documented custom exceptions (§5)

The design system has **no** `now-table` or drawer primitive, and `now-badge` is
numeric-only, so these are hand-rolled light-DOM markup: the **table grid**, the **status
pill**, the **slide-in drawer + overlay**, the **column resize / reorder handles**, the
**expand detail row**, and the **group header rows**. All are themed with Now design tokens
(`--now-color--*`, with screenshot-matched fallbacks) — no hardcoded brand colors and no
shadow-DOM piercing.

## The side drawer + droppable slot (Edit / Add-new)

When **Enable side drawer** is on, the component renders a right slide-in panel containing a
droppable **`form` slot**. In UI Builder, drop **`x-gegis-library-dynamic-form`** (or any
component) into that slot. The data-table only opens/closes the drawer and emits events; the
dropped form reads its record from page state:

1. Bind the dropped form's **Record sys_id** to a page client-state variable.
2. Set that variable from the data-table's **`EDIT_ACTION`** (existing record),
   **`ADD_NEW`** (value `"-1"` → blank create form), or **`OPEN_RECORD`** (row-click open)
   payloads.
3. Edit / Add-new / Open-record (side) automatically slide the drawer open.

Dynamic Form treats **`sysId = "-1"`** as create mode (blank form, **POST** on Save), so the
same drawer handles both edit and add-new.

## Configuration

Field pickers (`table_name`, `condition_string`, `field`, `field_list`) bind to the chosen
`table` via `@table`, mirroring the OOTB List Controller. They store plain strings; if an
editor doesn't render on your instance, switch that property's `fieldType` to `string` and
type the value. JSON properties (`customButtons`, `dropdownItems`, `rowHighlightRules`) are
plain strings holding a JSON **array** and are parsed at runtime (a blank or invalid value is
treated as empty).

| Group | Properties |
| --- | --- |
| **Variant** | `variant` — **Default** (full management list) or **View Only** (clean read-style list: inline search pill + plain columns + per-row Edit/Duplicate/Delete + footer pager; hides the toolbar chips, leading filter-icon column, per-column ⋮ menus, count badge / "last refreshed", More-actions menu, column reorder/resize, and inline cell editing) |
| **Data / columns** | `table`, `query`, `orderBy`, `orderDescending`, `fields`, `labels` |
| **Paging** | `pageSize`, `showPageSizeControl`, `pageSizes`, `pageSizeLabel` |
| **Text / header** | `heading`, `showCount` (record-count badge), `showLastRefreshed` ("Last refreshed …" subtitle), `showMoreActions` (⋮ overflow menu), `showColumnMenu` (per-column ⋮ menu), `itemLabel`, `emptyMessage` (dates always render pretty — no toggle) |
| **Row actions** | `showActions`, `showEdit`, `showCopy`, `showDelete` (built-in delete + confirm), `actionsLabel`, `editIcon` / `copyIcon` / `deleteIcon` (native **icon picker**, `fieldType: "icon"`), `actionColumnPosition` (left / right / sticky), `customButtons` (JSON) |
| **Search & query** | `showGlobalSearch`, `globalSearchPlaceholder`, `showColumnFilters` (initial open state), `showFilterToggle` (toolbar Filter chip), `showFilterIcon` (leading funnel toggle column — no checkbox), `showQuery` |
| **Toolbar** | `showRefresh`, `showReset`, `showExport`, `showListActions`, `showDropdown`, `dropdownPlaceholder`, `dropdownItems` (JSON), `showAddNew`, `addNewLabel` |
| **Drawer** | `enableDrawer`, `drawerTitle`, `drawerWidth` (resizable) |
| **Row click & references** | `rowClickAction` (none / expand / openRecord), `openRecordIn` (side / newTab), `enableReferenceLinks`, `referenceOpenIn` (side / newTab) |
| **Cells** | `highlightedValueFields`, `wrapAtChars` (0 = no wrap; N = wrap once a line exceeds N chars). **HTML columns auto-detected** from the field type and rendered. |
| **Appearance** | `zebra`, `rowHighlightRules` (JSON) |
| **Grid behavior** | `enableSort`, `enableGroupBy`, `groupByField`, `enableReorder`, `enableResize`, `enableInlineEdit` |

### Custom buttons / dropdown / highlight-rule JSON shapes

```jsonc
// customButtons — extra icon buttons in the action column
[{ "id": "approve", "label": "Approve", "icon": "check-outline" }]
// dropdownItems — toolbar menu items
[{ "id": "export", "label": "Export" }, { "id": "refresh", "label": "Refresh" }]
// rowHighlightRules — first match wins; op: is | is not | contains | startswith | endswith | > | < | empty | notempty
[{ "field": "priority", "op": "is", "value": "1", "color": "#fde8e8" }]
```

### Highlighted-value colors

There is no separate status field — put status-like columns in `highlightedValueFields` and
they render as a colored `now-highlighted-value` chip. The value maps (case-insensitive) to a
tone: **positive** (published/active/approved/complete/open/live), **info** (draft/new/pending/
in progress/submitted), **neutral** (archived/inactive/retired/closed/cancelled), **warning**
(review/on hold/overdue), **error** (rejected/failed/expired/critical). Unmapped → neutral gray.

### Delete is built-in

The Delete action is **not** an event you have to wire: it shows a confirmation dialog, then
`DELETE`s the record over the Table API and refreshes the page. (`DELETE_ACTION` still fires
afterward so a page can react if it wants.)

## Events

All events are declared in `now-ui.json` under `actions` (so the UI Builder **Events** tab
appears). Action-icon and reference-cell clicks call `stopPropagation`, so they never also
fire `ROW_CLICK`.

| Event | Payload | Fired when |
| --- | --- | --- |
| `ROW_CLICK` | `{ sysId, table }` | A row body is clicked (always). |
| `EDIT_ACTION` | `{ sysId, table }` | Edit icon clicked (also opens the drawer). |
| `COPY_ACTION` | `{ sysId, table }` | Duplicate icon clicked. |
| `DELETE_ACTION` | `{ sysId, table }` | Fired **after** the built-in delete succeeds (delete itself needs no wiring). |
| `ADD_NEW` | `{ table, sysId:"-1" }` | Add-new clicked (also opens the drawer). |
| `LIST_ACTION` | `{ name, sysId, label }` | A toolbar list/declarative UI Action is clicked (script not run). |
| `OPEN_RECORD` | `{ sysId, table, openIn }` | Row clicked while `rowClickAction = openRecord`. |
| `REFERENCE_CLICK` | `{ table, sysId, field, query }` | A clickable reference cell is clicked — referenced record + the list's current query. |
| `EXPORT` | `{ table, query }` | The Export button is clicked (bind to run a server export). |
| `DROPDOWN_SELECT` | `{ id, label }` | A toolbar dropdown item is selected. |
| `CUSTOM_ACTION` | `{ actionId, sysId, table }` | A configured custom row button is clicked. |
| `INLINE_EDIT` | `{ sysId, field, value }` | An inline-edited cell is committed (after the PATCH is requested). |

Internal UI state — expand/collapse, sort, group, column reorder/resize, search typing,
drawer open/close — is **not** exposed as an event (§9).

## Notes & limitations

- **List / declarative actions** are fetched from `sys_ui_action` (list-banner buttons,
  `active=true^list_banner_button=true`). Their scripts are **not** executed — bind
  `LIST_ACTION` to react/navigate. (Actions defined only in the newer declarative-action
  framework are not fetched.)
- Because paging is **server-side**, **group-by**, **conditional row highlighting**, and the
  **expand detail row** operate on the **currently loaded page** (group-by also server-sorts
  by the group field so groups stay contiguous across pages).
- **Inline editing** (double-click a cell) renders a **typed Horizon control** per field —
  choice → `now-dropdown`, reference → `now-typeahead` (live search of the referenced table by
  `name`), date/datetime → `now-date-time`, boolean → `now-dropdown`, number/text → `now-input`.
  The control **stages** a pending value; the edit only commits (PATCH + `INLINE_EDIT`) when the
  user clicks **Apply (✓)**, and **Cancel (✕)** discards it. Field types come from a
  `sys_dictionary` fetch (base table; reference display field assumed `name`). HTML columns are
  not inline-editable.
- **Grouped rows** are collapsible client-side and show a **per-page** record-count badge; the
  footer **Expand all / Collapse all** acts on the loaded page's groups.
- **HTML columns are auto-detected** from the field's dictionary type (HTML / wiki) and rendered
  via `innerHTML` — only meaningful for trusted content.
- **Global search** runs a **case-insensitive `LIKE` across the configured columns**
  (`colALIKEterm^ORcolBLIKEterm…`), so a valid term in **any** column returns rows — it does
  **not** depend on the table's text index. It is added as a trailing OR group so it ANDs with the
  fixed filter and column filters (`base AND (colA OR colB …)`), and matches are highlighted in the
  rows. Search runs **on Enter** (and on blur) — it is **not** debounced/live. Reference columns are
  searched by their display value via a `name` dot-walk (`ref.nameLIKEterm`); if a referenced table's
  display field isn't `name`, configure that column as the dot-walked display field (e.g.
  `broker.name`). When **Columns** is left empty (auto-derived), search falls back to the platform
  text-index operator (`123TEXTQUERY321`).
- **Headers, filter row, and the sort/group/filter chips persist even when a filter returns
  zero rows** (auto-derived columns are remembered from the last non-empty page).
- **New-tab** open for records / references uses the classic form URL (`/<table>.do?sys_id=…`).
  Workspace URLs differ — bind `OPEN_RECORD` / `REFERENCE_CLICK` to override navigation.

## Develop / deploy

```bash
npm install
npm run develop:au   # preview with assets from the Australia instance
npm run deploy       # deploy to the configured instance
npm test
```

> The component reads live data from the instance Table API, so it only populates against the
> target instance. Public-npm `now-*` are Rome-era; validate the true Horizon look on the
> instance. After deploy, reload UI Builder so the Events/Slots definition refreshes.
