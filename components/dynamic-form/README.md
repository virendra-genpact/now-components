# Dynamic Form (`x-gegis-library-dynamic-form`)

An **OOTB-style record form**. You configure it like the platform form
component — with a **table**, a record **sys_id** and a form **view** — and the
component talks to the **ServiceNow Table API** itself to build and save the
form. It also exposes **Read only** and **Autosave** toggles.

The **field controls are real Horizon `now-*` components** (`now-input`,
`now-select`, `now-checkbox`, `now-textarea`, `now-button`, `now-loader`)
composed inside our own card/section layout — so inputs stay in sync with
Horizon while the section grouping matches the provided design. HTTP is done with
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
2. **Field metadata** — `GET /api/now/table/sys_dictionary?...name={table}...`
   → label, type, mandatory, read-only per column.
3. **Choices** — `GET /api/now/table/sys_choice?...name={table}...`
   → choice lists (rendered as dropdowns).
4. **Layout** — `GET /api/now/table/sys_ui_element?...sys_ui_section.name={table}...`
   → sections + field order for the view. If no layout is found it falls back to
   a single section from the view's fields.

Editing a field marks it dirty. **Save** (or, when **Autosave** is on, each
field's blur/change) PATCHes the dirty fields back:

```
PATCH /api/now/table/{table}/{sysId}   { <field>: <value>, ... }
```

## Field rendering

| Dictionary type | Rendered as |
| --- | --- |
| choice / has a choice list | `now-select` (field is encoded into each item id `field::value` so changes can be mapped back, since `now-select` doesn't emit a field name) |
| true/false | `now-checkbox` (used instead of `now-toggle`, which emits no field name to disambiguate) |
| integer / decimal / float / currency | `now-input type="number"` |
| date | `now-date-time type="date"` |
| date/time | `now-date-time type="date-time"` |
| html / journal / translated | `now-textarea` (full-width) |
| reference / glide list | **read-only** `now-input` (display value) — editing references needs a record picker not available over plain REST |
| everything else | `now-input type="text"` |

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
| `sysId` | string | `""` | Record sys_id to load/save (bind from the page, e.g. a URL param). |
| `view` | string | `""` | Form view (blank = Default). Pass the view's **sys_id** (from `sys_ui_view`) or its name. A sys_id is resolved to its name first, then `sysparm_view={name}` makes the Table API return that view's own field set (so the form actually changes per view). |
| `heading` | string | `""` | Title at the top of the form (e.g. `Coverage`). Blank hides it. |
| `subheading` | string | `""` | Smaller text under the heading (e.g. `Building Coverage`). Blank hides it. |
| `readOnly` | boolean | `false` | Disable every field; hide Save. |
| `autosave` | boolean | `false` | PATCH each field on blur/change. |
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

## Notes & limitations

- **Reference fields are read-only** (display value only) — a proper reference
  picker is out of scope for plain REST.
- **Dot-walked fields are display-only for saving** — they belong to related
  records, so the base-table PATCH can't write them; they're shown (with resolved
  labels/types) but excluded from Save. Editing them via the related record is out
  of scope.
- **Choices** are read from `sys_choice` for `name={table}`; choices defined only
  on a parent (extended) table may not appear.
- **ACLs** still apply: the Table API enforces field/record ACLs for the current
  user, so the form only shows/saves what that user is allowed to.

## Develop / deploy

```bash
npm install
npm run develop:au   # playground with assets from the instance (HTTP needs a session)
npm run deploy
```

> The form is driven entirely by `table` / `sysId` / `view` — no metadata to
> hand-author. Scope is managed project-wide; see the
> [monorepo README](../../README.md#changing-scope-deploy-to-any-pdi).
