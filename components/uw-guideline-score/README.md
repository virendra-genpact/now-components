# UW Guideline Score — `x-gegis-library-uw-guideline-score`

An underwriting guideline **score summary bar** for ServiceNow **Next Experience**:
a final-score tile, risk level, pass/fail counts, and a status callout.

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ┌──┐  Final Score ⓘ      │ 12 Pass   3 Fail │  ⚠ Review Required – 3 …     │
│ │ 8│  ⚠ Medium Risk       │                  │     Manual review required   │
│ └──┘                                                                        │
└──────────────────────────────────────────────────────────────────────────┘
```

## Built per the rules

Composes standards (see
[SERVICENOW_CUSTOM_COMPONENT_DEV_RULES.md](../../../SERVICENOW_CUSTOM_COMPONENT_DEV_RULES.md)):
the right-hand **status callout is `now-alert`**, and the help / risk icons are
**`now-icon`**. The score tile, risk label, pass/fail counts, and dividers are owned
typography (no design-system component renders a KPI-style score bar).

## Properties

| Property | Type | Default | Description |
| --- | --- | --- | --- |
| `score` | string | `8` | Final score in the tile. |
| `scoreLabel` | string | `Final Score` | Caption next to the score. |
| `helpTooltip` | string | `How the final score is calculated` | Tooltip on the help icon; empty hides it. |
| `riskTone` | choice | `medium` | `low` (green) · `medium` (amber) · `high` (red) — tints the tile + risk text. |
| `riskLabel` | string | `Medium Risk` | Risk text; empty hides the row. |
| `passCount` / `passLabel` | string | `12` / `Pass` | Passing-criteria count + label. |
| `failCount` / `failLabel` | string | `3` / `Fail` | Failing-criteria count + label. |
| `showStatus` | boolean | `true` | Show the status callout on the right. |
| `statusType` | choice | `warning` | `info` · `warning` · `error` · `success`. |
| `statusTitle` | string | `Review Required – 3 Criteria need attention` | Callout title. |
| `statusMessage` | string | `Manual review required before proceeding` | Callout sub-text. |

## Develop

```bash
cd components/uw-guideline-score
npm install
npm run develop        # or develop:au for the Australia profile
```

> `snc develop` previews against the public-npm (Rome-era) `now-alert`; validate the
> final Horizon look on your instance. The bar wraps responsively on narrow widths.
