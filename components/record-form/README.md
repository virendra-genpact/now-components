# Record Form — `x-gegis-library-record-form`

Experimental self-fetching record form for ServiceNow **Next Experience**.

Give it a **table name**, **record sys_id**, and **form view** — the component reads
the form layout from `sys_ui_section` / `sys_ui_element` (exactly as the form builder
defines it) and the record values from the Table API. Each field renders **by its
dictionary type**: booleans → `now-toggle`, choice fields → `now-dropdown`, references →
searchable `now-typeahead` (queries the referenced table as you type), image/attachment
fields (`user_image`/`image`, e.g. Photo) → a read-only attachment indicator (not a text
box), everything else → `now-input` with the matching HTML input type
(number / email / tel / date / password / …). Within a section, fields lay out in
**columns split by the form's `.split`** element — matching the classic form (the left
column fills top→bottom, then the next), and collapsing to a single column in narrow
containers.

> **Type & choice detection (gotcha):** `sys_dictionary.internal_type` and `reference`
> are *reference* fields — the REST API returns them as objects, so we read `.value`
> (`refVal`) to get the canonical type name (`boolean`, `reference`, `integer`, …), not
> the raw object. A field is a **choice/dropdown when its dictionary `choice` attribute
> is `1`/`2`/`3`** — *not* when the type is `"choice"` (e.g. `notification` is type
> `integer` with `choice=3`). The record is fetched with `sysparm_display_value=all` so
> controls bind/save the real **value** (a choice's `2`, a reference sys_id) while
> reference fields show the **display** text.

**Auto-save fields** (`autoSaveFields`) PATCH the record immediately on blur. All other
changed fields are dirty-tracked and saved together when the Save button is clicked.

> **Design canvas vs runtime:** UI Builder's design canvas renders the component with its
> *default* (empty) property values, so it shows the "Record Form — set Table and Record
> Sys ID…" placeholder there even when you've configured those fields. The configured
> values apply in **Preview** and at **runtime**, where the record loads normally. The
> placeholder is expected design-time guidance, not an error.

## Built per the rules

Composes standard components:
- **`now-card`** — section containers
- **`now-input`** — text/number/email/tel/date/password field inputs
- **`now-toggle`** — boolean fields
- **`now-dropdown`** — choice fields (options from `sys_choice`)
- **`now-typeahead`** — reference fields (records searched live in the referenced table)
- **`now-icon`** — section collapse chevron
- **`now-button`** — Save + UI-action buttons

Data fetching is done via `fetch()` calls proxied through `now-cli.json` (`/api/*` →
instance). On the deployed instance, the same paths are native.

> **Authentication:** every REST call sends the session **`X-UserToken`** (`g_ck`)
> header. ServiceNow's REST API (Table API included) returns **401** for browser
> fetch/XHR that omits it — the session cookie alone is not enough. (The platform's own
> graphql / `/api/now/ui` calls work because the UXF runtime attaches the token; a raw
> `fetch` must add it explicitly.) The platform-blessed alternative is ui-core's
> `createHttpEffect` or a **Data Resource**, which handle auth for you.

## Properties

| Property | Type | Default | Description |
| --- | --- | --- | --- |
| `table` | string | `''` | ServiceNow table name (e.g. `incident`). |
| `sysId` | string | `''` | Record sys_id. |
| `formView` | string | `'Default view'` | Form view name as in the form builder. |
| `autoSaveFields` | json (array) | `[]` | Field names to PATCH immediately on blur, e.g. `["short_description","priority"]`. |
| `saveLabel` | string | `'Save'` | Save button label. |
| `readonly` | boolean | `false` | When `true`, all fields are read-only and Save is hidden. |
| `formLayout` | choice | `'classic'` | `classic` mirrors the form's `.split` columns; `responsive` flows fields in sequence into 1–4 columns by container width. |

## Events

| Event | Payload | When |
| --- | --- | --- |
| `RECORD_FORM_FIELD_CHANGED` | `{ name, value }` | Any field value changes (on blur). |
| `RECORD_FORM_FIELD_AUTO_SAVED` | `{ name, value }` | An auto-save field was successfully PATCHed. |
| `RECORD_FORM_SAVED` | `{ values }` | Save button PATCHed all non-auto-save dirty fields. |
| `RECORD_FORM_UI_ACTION_TRIGGERED` | `{ name, actionName, sysId, table, values }` | A `sys_ui_action` button was clicked (bind to a REST/transform to execute it). |
| `RECORD_FORM_LOAD_ERROR` | `{ error }` | Form layout or record fetch failed. |
| `RECORD_FORM_SAVE_ERROR` | `{ error }` | A PATCH (auto-save or Save button) failed. |

> Event names are **globally unique** in `sys_ux_event`, so every public event is
> prefixed `RECORD_FORM_` to avoid colliding with other components (e.g. `dynamic-form`
> also dispatches a `FIELD_CHANGED`/`FORM_SAVED`).

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
