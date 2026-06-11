# MCOPE Score Card — `x-gegis-library-mcope-score-card`

An MCOPE-analysis score card for ServiceNow **Next Experience** (UI Builder): a title
(with optional "(AI Generated)" suffix), a **score / risk badge** (low / medium / high),
a sentiments label, and a configurable bullet list of AI-generated sentiments. Clicking
the card emits an event.

```
┌────────────────────────────────────────────────────────────┐
│  Overall Score Based on MCOPE Analysis  (AI Generated)       │
│  ( 7/10 Medium Risk )                                        │
│  Risk Assessment Report Sentiments (AI Generated)            │
│  – sentiment one                                             │
│  – sentiment two                                             │
└────────────────────────────────────────────────────────────┘
```

> Migrated from the legacy `OLDER COMPONENTS/mcope-score-card`. Composes `now-card`
> (container + click + a11y); the header, pill badge (now-badge is numeric-only),
> sentiments label and bullet list are owned markup (documented §5). Severity badge
> colours are documented hex matching the legacy design; the raw-hex colour props were
> dropped (defaults unchanged), per the survey-version-item approach.

## Built from standard components

| Element | Standard component | Notes |
| --- | --- | --- |
| Card container | `now-card` | `interaction="click"`, `hideShadow` + token-themed hairline border |

> **§3.1 Horizon-only:** the deployed entry does **not** import `now-*` — the instance
> supplies the Horizon version via `innerComponents`; imported only in `example/` locally.

## Properties

| Property | Type | Default |
| --- | --- | --- |
| `cardTitle` | string | `Overall Score Based on MCOPE Analysis` |
| `titleSuffix` | string | `(AI Generated)` |
| `showTitleSuffix` | boolean | `true` |
| `scoreValue` | string | `7/10` |
| `riskLabel` | string | `Medium Risk` |
| `badgeVariant` | choice | `medium` (low / medium / high) |
| `sentimentsLabel` | string | `Risk Assessment Report Sentiments (AI Generated)` |
| `showSentimentsLabel` | boolean | `true` |
| `bulletPointsJson` | string | `''` (JSON array, or text split by delimiter) |
| `bulletDelimiter` | choice | `newline` (newline / comma) |
| `bulletStyle` | choice | `dash` (dash/disc/circle/square/none/decimal/lower-alpha/upper-alpha/lower-roman/upper-roman) |

## Events

| Event | Payload | When |
| --- | --- | --- |
| `MCOPE_SCORE_CARD_CLICKED` | `{ scoreValue, riskLabel, badgeVariant }` | Card clicked. |

## Develop / deploy

```bash
npm run develop      # local playground (now-card renders in legacy styling)
npm run deploy       # snc ui-component deploy
npm test             # logic tests
```
