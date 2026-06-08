# Dynamic Form (`x-gegis-library-dynamic-form`)

An **OOTB-style record form**. You configure it like the platform form
component — with a **table**, a record **sys_id** and a form **view** — and the
component talks to the **ServiceNow Table API** itself to build and save the
form. It also exposes **Read only** and **Autosave** toggles.

The **field controls are real Horizon `now-*` components** (`now-input`,
`now-select`, `now-checkbox`, `now-textarea`, `now-date-time`, `now-typeahead`,
`now-button`, `now-loader`) composed inside our own card/section layout — so
inputs stay in sync with Horizon while the section grouping matches the provided
design. HTTP is done with
`@servicenow/ui-effect-http` (`createHttpEffect`) so the instance
session / auth / scope are used automatically — there is **no hand-rolled
`fetch()`**.

> The `now-*` controls are declared in `now-ui.json` `innerComponents` and used
> by tag only; the deployed `src/` never imports them (the instance supplies the
> Horizon versions). They are imported **only** in `example/element.js` for the
> local playground, where they render in legacy styling — validate the true
> Horizon look on the instance.

## How it works

On load (and whenever `table` / `sysId` / `view` change) the component chains
these Table API calls, each via `createHttpEffect`:

1. **Record** — `GET /api/now/table/{table}/{sysId}?sysparm_display_value=all&sysparm_view={view}`
   → the field set for the view + values/display values.
2. **Table hierarchy** — `GET /api/now/table/sys_db_object?name={table}` (dot-walking
   `super_class`) → the table **and its parents**, so inherited fields are covered.
3. **Field metadata** — `GET /api/now/table/sys_dictionary?...nameIN{family}...`
   → label, type, mandatory, read-only per column, for the whole table family (so
   fields inherited from e.g. `task` — `comments`, `work_notes`, `state` — resolve
   correctly instead of falling back to a plain text box).
4. **Choices** — `GET /api/now/table/sys_choice?...nameIN{family}...`
   → choice lists (rendered as dropdowns), including choices defined on a parent table.
5. **Layout** — `GET /api/now/table/sys_ui_element?...sys_ui_section.name={table}...`
   → sections + field order for the view. If no layout is found it falls back to
   a single section from the view's fields.

Once the form is rendered it runs three **enrichment** calls (in the background,
so the form is usable immediately):

6. **Reference display fields** — `GET /api/now/table/sys_dictionary?...display=true`
   → which column to search/show per referenced table (so reference pickers
   search the right field; falls back to `name`).
7. **UI Policies** (when **Apply UI Policy** is on) — `sys_ui_policy` +
   `sys_ui_policy_action` for the table/view → dynamic mandatory / read-only /
   hidden behavior (see below).
8. **UI Actions** (when **Show UI Actions** is on) — `sys_ui_action` form buttons
   for the table → rendered as buttons (see below).

Editing a field marks it dirty. **Save** (or, when **Autosave** is on, each
field's blur/change) PATCHes the dirty fields back:

```
PATCH /api/now/table/{table}/{sysId}   { <field>: <value>, ... }
```

On a manual **Save**, visible + mandatory fields that are still empty are flagged
invalid and the save is blocked until they're filled.

## Reference fields (editable picker)

Reference (and document-id / list) fields render as a **`now-typeahead`**. As you
type, the component searches the **referenced table** over the Table API
(debounced ~300 ms) on that table's display field
(`{displayField}LIKE{term}^ORDERBY{displayField}`, top 25) and lists the matches.
Selecting one saves the chosen record's **sys_id** as the field value (and shows
its display value). The initial value is seeded from the loaded record.

## UI Policy (declarative)

When **Apply UI Policy** is on, active `sys_ui_policy` records for the table
(matching this view, or `global`) are loaded with their `sys_ui_policy_action`
rows. Each policy's **condition** is evaluated against the record's current values
(re-evaluated on every field change), and matching actions set fields
**mandatory**, **read-only** (`disabled`), or **hidden** (`visible=false`);
`reverse_if_false` applies the inverse when the condition is false. The encoded-
query evaluator supports `=`, `!=`, `IN`, `NOT IN`, `LIKE`, `NOT LIKE`,
`STARTSWITH`, `ENDSWITH`, `ISEMPTY`, `ISNOTEMPTY`, `>`, `<`, `>=`, `<=` and
`^` (AND) / `^OR` / `^NQ` grouping.

> **Limitation:** UI Policies that **run scripts** can't be executed over plain
> REST and are ignored — only the declarative field actions are applied.

## UI Actions (form buttons)

When **Show UI Actions** is on, the table's active form-button `sys_ui_action`
records are rendered as `now-button`s. Their placement is set by
**`uiActionPosition`** (`top` / `bottom` / `both`). Clicking one fires the
**`UI_ACTION_CLICKED`** event with `{ name, sysId, label }` so the UI Builder page
can react (navigate, open a modal, call a Data Resource, …).

> **Limitation:** the UI action's own server/client **script is not executed** —
> the component emits the event and the page decides what to do.

## Field rendering

| Dictionary type | Rendered as |
| --- | --- |
| choice / has a choice list | `now-select` (field is encoded into each item id `field::value` so changes can be mapped back, since `now-select` doesn't emit a field name) |
| true/false | `now-toggle` (default) or `now-checkbox` — set by `booleanControl` |
| integer / decimal / float / currency / price | `now-input type="number"` |
| date / due date | `now-date-time type="date"` |
| date/time / time | `now-date-time type="date-time"` |
| html / journal / journal input / journal list / translated / wiki | `now-textarea` (full-width) |
| string with `max_length` > 255 | `now-textarea` (full-width) — long strings (e.g. an `address` String(400)) render multi-line, like the platform form |
| reference / document id | **editable** `now-typeahead` — searches the referenced table over the Table API as you type and saves the chosen record's sys_id (see [Reference fields](#reference-fields-editable-picker)) |
| glide list / list (multi-value) | **editable** `now-typeahead-multi` — pill multi-select; same server search, saves a CSV of sys_ids |
| password / encrypted text | `now-input-password` (masked) |
| url | `now-input-url` |
| phone number (E164) | `now-input-phone` |
| everything else (icon, color, geo point, script, conditions, media, …) | `now-input type="text"` fallback |

### Control coverage

| ServiceNow field | Control used | Notes |
| --- | --- | --- |
| Choice | `now-select` (dropdown) | platform default for choices |
| True/False | `now-toggle` (default) or `now-checkbox` | set by `booleanControl`. `now-toggle` carries no field name on change, so the value is flipped from the view's `on-click` (the field is known there) and fed back via the controlled `checked` prop |
| Reference / Document ID | `now-typeahead` | single record picker |
| Glide List / List | `now-typeahead-multi` | pill multi-select |
| Radio | — | choices render as a dropdown (platform default); `now-radio-buttons` is available but not auto-applied |

### Dot-walked fields

Views often include **dot-walked** fields (e.g. `broker.brokeraddress.address1`).
Their labels/types aren't in the base table's dictionary, so the component walks
each reference hop — fetching `sys_dictionary` for the related tables — to resolve
the real label, type, and choices of the final column. If a hop can't be resolved
it falls back to a humanized column name.

## Properties

| Property | Type | Default | Description |
| --- | --- | --- | --- |
| `table` | string | `""` | Table to load, e.g. `incident`. |
| `sysId` | string | `""` | Record sys_id to load/save (bind from the page, e.g. a URL param). Pass **`-1`** for **create mode** — see below. |
| `view` | string | `""` | Form view (blank = Default). Pass the view's **sys_id** (from `sys_ui_view`) or its name. A sys_id is resolved to its name first, then `sysparm_view={name}` makes the Table API return that view's own field set (so the form actually changes per view). |
| `heading` | string | `""` | Title at the top of the form (e.g. `Coverage`). Blank hides it. |
| `subheading` | string | `""` | Smaller text under the heading (e.g. `Building Coverage`). Blank hides it. |
| `readOnly` | boolean | `false` | Disable every field; hide Save. |
| `autosave` | boolean | `false` | PATCH each field on blur/change. |
| `saveRelated` | boolean | `false` | Also save edits to dot-walked fields to their related records (resolve each record + PATCH it). Needs write ACLs + existing references. |
| `applyUiPolicy` | boolean | `true` | Load + evaluate declarative UI Policies to set fields mandatory / read-only / hidden as values change. Script-based policies are ignored. |
| `showUiActions` | boolean | `true` | Render the table's active form-button UI Actions; clicking one fires `UI_ACTION_CLICKED` (the action's script is not run). |
| `uiActionPosition` | choice | `top` | Where the UI Action buttons render: `top`, `bottom`, or `both`. |
| `booleanControl` | choice | `toggle` | How true/false fields render: `toggle` (now-toggle switch) or `checkbox` (now-checkbox). |
| `columns` | number | `2` | Fields per row per section. |
| `saveLabel` | string | `Save` | Manual Save button text. |
| `showSave` | boolean | `true` | Show the Save button (when not read-only). |
| `saveButtonPosition` | choice | `bottom` | Place the Save button `top` (beside the heading), `bottom`, or `both`. |

## Events (UI Builder `actions`)

| Event | Payload | When |
| --- | --- | --- |
| `FIELD_CHANGED` | `{ name, value }` | A field changes |
| `FORM_SAVED` | `{ table, sysId }` | A save succeeds |
| `SAVE_ERROR` | `{ message }` | A save fails |
| `UI_ACTION_CLICKED` | `{ name, sysId, label }` | A form-button UI Action is clicked (its script is not run) |

## Notes & limitations

- **Reference fields are editable** via a `now-typeahead` that searches the
  referenced table as you type and saves the selected record's sys_id.
- **Glide List / List fields are editable** via a `now-typeahead-multi` pill
  picker; selections save as a comma-separated list of sys_ids.
- **UI Policy** — only **declarative** field actions (mandatory / read-only /
  hidden) are applied; policies that **run scripts** are ignored.
- **UI Actions** — form buttons are rendered and emit `UI_ACTION_CLICKED`; the
  action's own server/client **script is not executed**.
- **Dot-walked fields** — by default they're display-only (the base PATCH can't
  write them). Turn on **`saveRelated`** to also save them: the component groups
  the edits by related record, resolves each record's sys_id (one extra GET), and
  PATCHes each related record. Needs write ACLs on those records and a non-empty
  reference; unresolved chains are skipped.
- **Choices** are read from `sys_choice` for `name={table}`; choices defined only
  on a parent (extended) table may not appear.
- **ACLs** still apply: the Table API enforces field/record ACLs for the current
  user, so the form only shows/saves what that user is allowed to.

## Create mode (`sysId = "-1"`)

Pass **`sysId = "-1"`** to render a **blank create form** for the table/view:

- the record GET is skipped; fields come from the form **layout** (or the table
  dictionary as a fallback) with empty values,
- **Save** issues a **`POST /api/now/table/{table}`** with the entered (non-dot-walked)
  fields instead of a PATCH,
- on success, **`FORM_SAVED`** carries the **new record's `sys_id`** so the page can
  rebind / refresh (autosave is ignored in create mode — the record doesn't exist yet).

This is what powers the Data Table's "Add new": the list opens its drawer and fires
`ADD_NEW { sysId: "-1" }`; bind a dropped Dynamic Form's **Record sys_id** to it.

## Develop / deploy

```bash
npm install
npm run develop:au   # playground with assets from the instance (HTTP needs a session)
npm run deploy
```

> The form is driven entirely by `table` / `sysId` / `view` — no metadata to
> hand-author. Scope is managed project-wide; see the
> [monorepo README](../../README.md#changing-scope-deploy-to-any-pdi).
