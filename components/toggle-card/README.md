# Toggle Card (`x-gegis-library-toggle-card`)

A single titled card with a list of **on/off toggle rows** (optional required
asterisk). 100% custom, **zero `now-*` deps**; pure-CSS switch. Drop several to
build a grid like the reference page.

## Input

`title` plus an `items` JSON array — each item:

```json
{
  "title": "Core Property",
  "items": [
    { "label": "Building", "on": true, "required": true },
    { "label": "BPP", "on": true, "required": false },
    { "label": "PPOuilding", "on": true, "required": true }
  ]
}
```

Bind the `items` property to a data resource (or paste JSON). Toggling a row flips
its `on` value and fires `TOGGLE_CHANGED` with `{ index, label, on }`.

## Properties

| Property | Type | Default | Description |
| --- | --- | --- | --- |
| `title` | string | `Core Property` | Card heading. |
| `items` | json | `[]` | Rows: `{ label, on, required }`. |
| `onLabel` | string | `On` | Text beside a toggle when on. |
| `offLabel` | string | `Off` | Text beside a toggle when off. |
| `showStateText` | boolean | `true` | Show the On/Off text. |

## Events

| Event | Payload |
| --- | --- |
| `TOGGLE_CHANGED` | `{ index, label, on }` |

## Build the grid

This is a **single card**. To reproduce the reference page, place multiple
instances in a layout (e.g. a 2-column UI Builder container), one per section
(Core Property, Business Continuity, Equipment & Operations, …), each bound to its
own `items` array.

## Develop / deploy

```bash
npm install
npm run develop      # live playground (port 8085), seeded with the Core Property card
npm run deploy
```

> Scope is managed project-wide; see the [monorepo README](../../README.md#changing-scope-deploy-to-any-pdi).
