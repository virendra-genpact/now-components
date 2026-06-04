# Data Table (`x-gegis-library-data-table`)

A configurable record list / data table for ServiceNow Next Experience (UI Builder).
Give it a **table** name and an encoded **query**; it loads the matching records over
the **Table API** and renders them in a paginated, OOTB-style table with a colored
**status pill** and per-row **Edit / Duplicate / Delete** actions.

![reference design](../../../docs/data-table.png)

## How it works

- Data is fetched over `@servicenow/ui-effect-http` (`createHttpEffect`) against
  `/api/now/table/:table`, so the instance session / auth / scope are used
  automatically — no hand-rolled `fetch()`.
- Records are fetched with `sysparm_display_value=all` (so each cell carries both the
  raw `value` and the `display_value`) up to **Max records**, then paginated
  client-side so the footer count (`Showing 1-5 of 5`) is exact.
- `sys_id` is always requested so row + action events can identify the record.

## Composition (design-system components used)

Per `SERVICENOW_CUSTOM_COMPONENT_DEV_RULES.md` §0, the component composes standard
Horizon components wherever one exists:

| Piece | Component |
| --- | --- |
| Edit / Duplicate / Delete icons | `now-button-iconic` |
| Loading state | `now-loader` |
| Pagination | `now-pagination-control` |
| Icons | `now-icon` |

### Documented custom exception (§5)

The **table grid** (`<table>`) and the **status pill** are hand-rolled light-DOM
markup because the design system has **no** `now-table` primitive, and `now-badge` is
**numeric-only** (it cannot render a text status like "Draft"). Both are themed with
Now design tokens (`--now-color--*`) with sensible fallbacks — no hardcoded brand
colors and no shadow-DOM piercing.

## Configuration

The config panel mirrors the OOTB **List Controller** experience using platform
field types that bind to the chosen `table` via `@table`, so the Columns / Status /
Sort pickers list that table's fields and **dot-walk into reference fields**:

| Property | `fieldType` | Default | Notes |
| --- | --- | --- | --- |
| `table` | `table_name` | `""` | Table picker. Drives every field picker below. |
| `query` | `condition_string` | `""` | "Edit fixed filter" condition builder → encoded query. |
| `orderBy` | `field` | `""` | Field picker (bound to `@table`) to sort by. |
| `orderDescending` | `boolean` | `false` | Sort the chosen field descending. |
| `fields` | `field_list` | `""` | **Columns "+Add" picker** (ordered, dot-walk). Blank → every returned field. |
| `labels` | `string` | `""` | Optional header overrides matching `fields`; blanks fall back to the prettified name. |
| `statusField` | `field` | `"status"` | Field picker; rendered as a colored pill. Blank → plain text. |
| `pageSize` | `number` | `5` | Rows per page. |
| `maxRecords` | `number` | `1000` | Cap on records fetched (pagination is client-side). |
| `heading` | `string` | `""` | Optional title above the table. |
| `itemLabel` | `string` | `"records"` | Noun in the footer count. |
| `showActions` / `showEdit` / `showCopy` / `showDelete` | `boolean` | `true` | Per-row action icons. |
| `actionsLabel` | `string` | `"Actions"` | Header for the actions column. |
| `editIcon` / `copyIcon` / `deleteIcon` | `string` | `pencil-outline` / `copy-outline` / `trash-outline` | `now-icon` names. |
| `prettyDates` | `boolean` | `true` | Format ISO date values as `Mon D, YYYY`. |
| `emptyMessage` | `string` | `"No records found"` | Shown when no records match. |

> **Field-type note:** `table_name`, `condition_string`, `field`, and `field_list`
> are platform property editors (the same ones the List Controller uses). They all
> store plain strings, so the runtime is unaffected. If any editor doesn't render for
> a custom component on your instance, change that property's `fieldType` to `string`
> in `now-ui.json` and type the value manually — no code change is needed. Verify the
> pickers on the target instance.

### Status pill colors

The `statusField` value is mapped (case-insensitive) to a semantic tone:

- **positive** (green): `published`, `active`, `approved`, `complete`, `open`, `live`
- **info** (blue): `draft`, `new`, `pending`, `in progress`, `submitted`
- **neutral** (gray): `archived`, `inactive`, `retired`, `closed`, `cancelled`
- **warning** (amber): `review`, `on hold`, `overdue`
- **error** (red): `rejected`, `failed`, `expired`, `critical`

Anything unmapped falls back to neutral.

## Events

All events are declared in `now-ui.json` under `actions` (so the UI Builder **Events**
tab appears and they can be bound). Each carries `{ sysId, table }`:

| Event | Fired when |
| --- | --- |
| `ROW_CLICK` | A row body is clicked. |
| `EDIT_ACTION` | The edit (pencil) icon is clicked. |
| `COPY_ACTION` | The duplicate (copy) icon is clicked. |
| `DELETE_ACTION` | The delete (trash) icon is clicked. |

Action-icon clicks call `stopPropagation`, so they never also trigger `ROW_CLICK`.

## Develop / deploy

```bash
npm install
npm run develop:au   # preview with assets from the Australia instance
npm run deploy       # deploy to the configured instance
npm test
```

> The component reads live data from the instance Table API, so it only populates
> when served against the target instance. Public-npm `now-*` are Rome-era; validate
> the true Horizon look on the instance. `now-button-iconic` is **not** on public
> npm, so the per-row action icons render only on the instance (not in local
> preview); all other parts preview locally.
