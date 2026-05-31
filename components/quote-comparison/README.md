# Quote Versions Comparison (`x-gegis-library-quote-comparison`)

A fully custom comparison grid: each **version is a column** (v1 / v2 / v3 — records
from the same table), and **fields grouped by section are rows**. Driven by a JSON
array. 100% custom, **zero `now-*` deps** (no `now-alert`); CSS grid + unicode ✓/✗.

## Input: the `versions` JSON array

Bind an array of version objects. The **first version defines the rows**; every
column reads its value at the same section/field position (versions share fields).

```json
[
  {
    "header": { "title": "Quote Versions Comparison", "option": "Option 3 v: 3.0",
      "status": { "label": "Broker Approved", "type": "pill", "color": "green" }, "selectable": true },
    "sections": [
      { "sectionName": "Policy Basics", "type": "header_summary",
        "fields": [
          { "label": "Authority Check", "value": true, "displayType": "tick_cross" },
          { "label": "Purpose", "value": "Balanced Option", "displayType": "text" }
        ] },
      { "sectionName": "TIV & Limits", "type": "section",
        "fields": [
          { "label": "Building Limit", "value": 5000000, "displayType": "currency", "formatted": "$5,000,000" },
          { "label": "Total TIV", "value": 8000000, "displayType": "currency_bold", "formatted": "$8,000,000", "isAggregation": true }
        ] }
    ],
    "actions": [ { "label": "View Details", "type": "button", "style": "secondary" } ]
  }
]
```

### Supported `displayType`s

| displayType | Rendered as |
| --- | --- |
| `text`, `date_range`, `number` | `formatted` if present, else `value` |
| `tick_cross` | green ✓ (truthy) / red ✗ (falsy), centered |
| `currency`, `percentage` | `formatted` if present, else `value` |
| `currency_bold` / `isAggregation: true` | bold value + highlighted row |
| `pill` | colored pill (`pillColor`: green/blue/gray/red/orange) |
| `text_truncated` | single-line, ellipsis |
| `trend` (on a field) | small ▲/▼ + optional `vsBaseline.formatted` in color |

- `header.option` → blue option label; `header.status` → pill; `header.selectable` → a **Select** checkbox (fires `VERSION_SELECTED`).
- `type: "header_summary"` section → plain rows under the header (no gray band); its `sectionName` shows beside the header.
- `actions[]` → footer buttons per column (fire `ACTION_CLICKED`).

## Properties

| Property | Type | Default | Description |
| --- | --- | --- | --- |
| `versions` | json | `[]` | The array above (one object per column). |
| `title` | string | `Quote Versions Comparison` | Fallback title if the first version has no `header.title`. |
| `labelWidth` | string | `200px` | CSS width of the left label column. |

## Events

| Event | Payload |
| --- | --- |
| `VERSION_SELECTED` | `{ index, checked }` |
| `ACTION_CLICKED` | `{ index, action }` |

## Develop / deploy

```bash
npm install
npm run develop      # live playground, seeded with 3 sample versions
npm run deploy
```

> This is a **basic** first pass — it covers the layout and the common displayTypes.
> Scope is managed project-wide; see the [monorepo README](../../README.md#changing-scope-deploy-to-any-pdi).
