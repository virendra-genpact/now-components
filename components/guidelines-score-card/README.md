# Guidelines Score Card — `x-gegis-library-guidelines-score-card`

A composite card for ServiceNow **Next Experience** (UI Builder): on the left a
guidelines **score + risk badge** and a **pass/fail criteria** summary (split by a
divider); on the right an embedded **review banner** (info / warning / critical).

```
┌──────────────────────────────────────────────────────────────────────┐
│ GUIDELINES SCORE        │ CRITERIA RESULTS    │ ⚠ Review Required …     │
│ 8  [Low Risk]           │ 12 Pass | 3 Fail    │   Manual review required │
│ ? Score Methodology     │                     │                          │
└──────────────────────────────────────────────────────────────────────┘
```

> Migrated from the legacy `OLDER COMPONENTS/guidelines-score-card`, **UI preserved**.

## Built from standard components

| Element | Standard component | Notes |
| --- | --- | --- |
| Outer card | `now-card` | `interaction="none"`, token-themed border |

The two-section score/criteria layout, the risk badge, the methodology button and the
embedded tinted banner are **owned markup** (documented §5 — `now-alert` can't reproduce
the icon-circle banner; the score/criteria layout has no DS equivalent). Glyphs via
`props={{innerHTML}}`; banner/risk colours are documented hex matching the legacy design.

> **§3.1 Horizon-only:** the deployed entry does **not** import `now-*` — the instance
> supplies the Horizon `now-card` via `innerComponents`; imported only in `example/`.

## Properties

Score: `scoreLabel`, `scoreValue`, `riskLabel`, `riskVariant` (low/medium/high),
`showScoreMethodology`, `scoreMethodologyLabel`. Criteria: `criteriaLabel`, `passCount`,
`passLabel`, `failCount`, `failLabel`. Banner: `showBanner`, `bannerVariant`
(info/warning/critical), `bannerTitle`, `bannerSubtitle`, `showBannerIcon`,
`bannerLinkText`, `showBannerLinkText`.

## Events

| Event | Payload | When |
| --- | --- | --- |
| `GUIDELINES_SCORE_METHODOLOGY_CLICKED` | `{ scoreValue, riskLabel, riskVariant }` | Methodology button clicked. |
| `GUIDELINES_BANNER_LINK_CLICKED` | `{ linkText, variant }` | Banner link clicked. |

## Develop / deploy

```bash
npm run develop      # local playground (now-card renders in legacy styling)
npm run deploy       # snc ui-component deploy
npm test             # logic tests
```
