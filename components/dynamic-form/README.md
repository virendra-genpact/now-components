# Dynamic Form (`x-gegis-library-dynamic-form`)

A fully custom, **metadata-driven** sectioned form: section cards with a
multi-column grid of `select` / `text` / read-only fields. Values bind to a
record; **Save** fires an event for a REST data resource. 100% custom, **zero
`now-*` deps**.

## How it works

- **`sections`** (JSON array) — the grouping metadata (comes from your external
  metadata). Each section: `{ sectionName, fields: [ field ] }`.
- **`field`** — `{ label, name, type, options?, placeholder?, readonly?, value? }`
  - `type: "select"` → dropdown (white, chevron). `options` = `[{label,value}]` or strings.
  - `type: "text"` → text input. Add `readonly: true` for **auto-derived / gray** fields.
- **`values`** (JSON object) — current values keyed by field `name`. **Bind your
  table record here.** Editing updates this map and fires `FIELD_CHANGED`.

```json
{
  "sections": [
    { "sectionName": "Address & Location",
      "fields": [
        { "label": "Address", "name": "address", "type": "select", "options": ["CA","NY","TX"], "placeholder": "Selected: CA, NY, TX" },
        { "label": "City", "name": "city", "type": "text", "readonly": true, "placeholder": "Selected: CA, NY, TX" }
      ] }
  ]
}
```

## Saving over HTTP (the ServiceNow-correct way)

The component does **not** call `fetch` itself. On Save it dispatches:

```
FORM_SAVED  →  { values: { <name>: <value>, ... } }
```

In UI Builder, **bind the `FORM_SAVED` event** to a **REST / transform data
resource** (or a client state action) that performs the actual HTTP save with the
event payload. That keeps auth, headers, and scope where they belong.

## Properties

| Property | Type | Default | Description |
| --- | --- | --- | --- |
| `sections` | json | `[]` | Section + field metadata (above). |
| `values` | json | `{}` | Field values keyed by name (bind your record). |
| `columns` | number | `3` | Fields per row per section. |
| `saveLabel` | string | `Save` | Save button text. |
| `showSave` | boolean | `true` | Show the Save button. |

## Events

| Event | Payload |
| --- | --- |
| `FIELD_CHANGED` | `{ name, value }` |
| `FORM_SAVED` | `{ values }` — bind to your REST data resource |

## Develop / deploy

```bash
npm install
npm run develop      # playground (port 8087), seeded with the reference form
npm run deploy
```

> Grouping/metadata is yours to provide via `sections`. Scope is managed
> project-wide; see the [monorepo README](../../README.md#changing-scope-deploy-to-any-pdi).
