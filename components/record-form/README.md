# Record Form — `x-gegis-library-record-form`

Experimental self-fetching record form for ServiceNow **Next Experience**.

Give it a **table name**, **record sys_id**, and **form view** — the component reads
the form layout from `sys_ui_section` / `sys_ui_element` (exactly as the form builder
defines it) and the record values from the Table API. Fields are rendered as editable
`now-input` controls grouped by their sections.

**Auto-save fields** (`autoSaveFields`) PATCH the record immediately on blur. All other
changed fields are dirty-tracked and saved together when the Save button is clicked.

## Built per the rules

Composes standard components:
- **`now-card`** — section containers
- **`now-input`** — field inputs
- **`now-button`** — Save button

Data fetching is done via `fetch()` calls proxied through `now-cli.json` (`/api/*` →
instance). On the deployed instance, the same paths are native.

## Properties

| Property | Type | Default | Description |
| --- | --- | --- | --- |
| `table` | string | `''` | ServiceNow table name (e.g. `incident`). |
| `sysId` | string | `''` | Record sys_id. |
| `formView` | string | `'Default view'` | Form view name as in the form builder. |
| `autoSaveFields` | json (array) | `[]` | Field names to PATCH immediately on blur, e.g. `["short_description","priority"]`. |
| `saveLabel` | string | `'Save'` | Save button label. |
| `readonly` | boolean | `false` | When `true`, all fields are read-only and Save is hidden. |

## Events

| Event | Payload | When |
| --- | --- | --- |
| `FIELD_CHANGED` | `{ name, value }` | Any field value changes (on blur). |
| `FIELD_AUTO_SAVED` | `{ name, value }` | An auto-save field was successfully PATCHed. |
| `FORM_SAVED` | `{ values }` | Save button PATCHed all non-auto-save dirty fields. |
| `FORM_LOAD_ERROR` | `{ error }` | Form layout or record fetch failed. |
| `FORM_SAVE_ERROR` | `{ error }` | A PATCH (auto-save or Save button) failed. |

## Data fetching

Three API calls on load (sections + elements in parallel with record values):

| Call | URL | Purpose |
| --- | --- | --- |
| 1 | `GET /api/now/table/sys_ui_section?...` | Form sections for the view |
| 2 | `GET /api/now/table/sys_ui_element?...` | All fields across all sections (batched) |
| 3 | `GET /api/now/table/{table}/{sysId}?sysparm_display_value=true` | Record values |

Field labels are derived from the column name (snake_case → Title Case). A future
enhancement can query `sys_dictionary` for proper labels.

## Develop

```bash
cd components/record-form
npm install
npm run develop       # or develop:au for the Australia profile
```

In the playground panel, set `table` and `sysId` to a real record on your connected
instance. The dev server proxies `/api/*` to the instance.

> Local preview shows Rome-era `now-*` styling. Validate the Horizon look on
> the instance after `npm run deploy`.

## Limitations (experimental)

- Field labels come from snake_case conversion, not `sys_dictionary`. Enhance later.
- All fields render as `now-input` (text). Type-specific rendering (reference, choice,
  date) can be added incrementally.
- No field-level validation beyond what `now-input` provides natively.
