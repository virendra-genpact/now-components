# Extraction Summary Card (`x-gegis-library-extraction-summary`)

A fully custom version/extraction summary for ServiceNow Next Experience (UI
Builder): a **version dropdown** plus a **green summary card** (name, `CURRENT`
badge, created / triggered-by, document & field stats, and a red low-confidence
warning). Driven by a **JSON array**; changing the dropdown switches the displayed
version.

## Why custom-from-scratch (per the dev rules §1/§3)

This is a pixel-specific data card with a layout no single default component
reproduces (colored stat run, green tint card, low-confidence warning row). It uses
**zero `now-*` dependencies** — explicitly **not** `now-alert` — so it renders
identically locally and on the instance and can't hit the bundling / icon-library
issues. Icons (check, warning, clock) are drawn in **pure CSS** (no JSX `<svg>`,
which the snabbdom renderer mishandles).

## Input: the `versions` JSON array

Bind a data resource (or static JSON) to the `versions` property. Each item:

```json
[
  {
    "id": "v3",
    "label": "V3 – Latest",
    "name": "Extract-V3",
    "current": true,
    "created": "2026-02-25 16:14:33",
    "triggeredBy": "E005 - Additional Insured Endorsement Request",
    "documents": 5,
    "totalFields": 23,
    "newFields": 6,
    "modified": 2,
    "lowConfidence": 2
  }
]
```

| Field | Shown as |
| --- | --- |
| `label` | the dropdown option text |
| `name` | bold card title (e.g. `Extract-V3`) |
| `current` | shows the green `CURRENT` badge when `true` |
| `created`, `triggeredBy` | the gray meta line |
| `documents`, `totalFields` | dark stat numbers |
| `newFields` | green stat |
| `modified` | blue stat |
| `lowConfidence` | when `> 0`, shows the red warning row with the count |

## Properties

| Property | Type | Default | Description |
| --- | --- | --- | --- |
| `versions` | json | `[]` | The array above. |
| `selectedId` | string | `''` | Selected version `id`; empty shows the first item. Updated on dropdown change. |
| `versionLabel` | string | `Version:` | Small label above the dropdown. |
| `button1Label` | string | `View Extraction Timeline` | Left button (clock icon). |
| `button2Label` | string | `Proceed to Data Audit` | Right button. |

## Events

| Event | Payload |
| --- | --- |
| `VERSION_CHANGED` | `{ id }` |
| `VIEW_TIMELINE_CLICKED` | `{ id }` |
| `PROCEED_TO_AUDIT_CLICKED` | `{ id }` |

## Develop / deploy

```bash
npm install
npm run develop      # live playground (seeded with sample versions)
npm run deploy       # snc ui-component deploy
```

> Scope: managed project-wide — see the [monorepo README](../../README.md#changing-scope-deploy-to-any-pdi).
