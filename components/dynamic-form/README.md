# Dynamic Form (`x-gegis-library-dynamic-form`)

An **OOTB-style record form**. You configure it like the platform form
component — with a **table**, a record **sys_id** and a form **view** — and the
component talks to the **ServiceNow Table API** itself to build and save the
form. It also exposes **Read only** and **Autosave** toggles.

100% custom markup, **zero `now-*` deps**. HTTP is done with
`@servicenow/ui-effect-http` (`createHttpEffect`) so the instance
session / auth / scope are used automatically — there is **no hand-rolled
`fetch()`**.

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
| choice / has a choice list | dropdown (`<select>`) |
| true/false | checkbox |
| integer / decimal / float / currency | number input |
| date | date input |
| html / journal / translated | textarea (full-width) |
| reference / glide list | **read-only** text (display value) — editing references needs a record picker not available over plain REST |
| everything else | text input |

## Properties

| Property | Type | Default | Description |
| --- | --- | --- | --- |
| `table` | string | `""` | Table to load, e.g. `incident`. |
| `sysId` | string | `""` | Record sys_id to load/save (bind from the page, e.g. a URL param). |
| `view` | string | `""` | Form view (blank = Default). Pass the view's **sys_id** (from `sys_ui_view`) or its name. A sys_id matches the section layout directly; a name also drives `sysparm_view` on the record fetch. |
| `readOnly` | boolean | `false` | Disable every field; hide Save. |
| `autosave` | boolean | `false` | PATCH each field on blur/change. |
| `columns` | number | `2` | Fields per row per section. |
| `saveLabel` | string | `Save` | Manual Save button text. |
| `showSave` | boolean | `true` | Show the Save button (when not read-only). |

## Events (UI Builder `actions`)

| Event | Payload | When |
| --- | --- | --- |
| `FIELD_CHANGED` | `{ name, value }` | A field changes |
| `FORM_SAVED` | `{ table, sysId }` | A save succeeds |
| `SAVE_ERROR` | `{ message }` | A save fails |

## Notes & limitations

- **Reference fields are read-only** (display value only) — a proper reference
  picker is out of scope for plain REST.
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
