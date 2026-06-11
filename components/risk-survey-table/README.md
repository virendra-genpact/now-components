# Risk Survey Table — `x-gegis-library-risk-survey-table`

A risk-survey results table for ServiceNow **Next Experience** (UI Builder), driven by
columns/rows JSON: a **factor** column, a **score badge** (low / medium / high), an
**AI-sentiments** bullet column, and either a chevron affordance or per-row **action
buttons**. Handles **loading / empty / error** states and an optional href-on-row-click
mode. Responsive: collapses to stacked cards on narrow widths.

```
┌───────────────────────────────────────────────────────────────────────────┐
│ RISK SURVEY FACTORS │ SCORE (AI Generated) │ RISK ASSESSMENT … (AI Generated)│
├───────────────────────────────────────────────────────────────────────────┤
│ Fire                │ [ 7/10 Medium Risk ] │ - sentiment one              ›  │
│ Flood               │ [ 3/10 Low Risk    ] │ - sentiment two              ›  │
└───────────────────────────────────────────────────────────────────────────┘
```

> Migrated from the legacy `OLDER COMPONENTS/risk-survey-table`, **UI preserved**.

## Built from standard components

| Element | Standard component | Notes |
| --- | --- | --- |
| Row chevron | `now-icon` | `chevron-right-outline` |
| Action buttons | `now-button` | `variant` primary / secondary |

The **grid table itself is owned markup** (documented §0/§5 — the design system ships no
`now-table` primitive; same rationale as the library `data-table` component). Colours
are documented hex matching the legacy design; the raw-hex colour props (header / factor
/ sentiment / chevron / background / border / hover) and per-button custom colours were
dropped (defaults unchanged), per the survey-version-item approach.

> **§3.1 Horizon-only:** the deployed entry does **not** import `now-*` — the instance
> supplies the Horizon versions via `innerComponents`; imported only in `example/`.

## Properties

| Property | Type | Default |
| --- | --- | --- |
| `columnsJson` | string | `''` (default factor / score / sentiments columns) |
| `rowsJson` | string | `''` (array, or `{loading}`/`{error}`/`{data\|rows\|items}` wrapper) |
| `showChevron` | boolean | `true` |
| `enableHref` | boolean | `false` |
| `hrefKey` | string | `href` |
| `openInNewWindow` | boolean | `true` |
| `enableActionButtons` | boolean | `false` |
| `actionButtonsJson` | string | `''` (up to 3 × `{ actionKey, label, variant }`) |

## Events

| Event | Payload | When |
| --- | --- | --- |
| `RISK_SURVEY_ROW_CLICKED` | `{ row, rowIndex }` | Row clicked (action buttons + href off). |
| `RISK_SURVEY_CONTEXT_BUTTON_CLICKED` | `{ actionKey, button, row, rowIndex }` | Action button clicked. |

## Develop / deploy

```bash
npm run develop      # local playground (now-* render in legacy styling)
npm run deploy       # snc ui-component deploy
npm test             # logic tests
```
