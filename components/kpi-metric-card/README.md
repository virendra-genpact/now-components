# KPI Metric Card — `x-gegis-library-kpi-metric-card`

A KPI tile for ServiceNow **Next Experience** (UI Builder): a title (with optional icon
box), a **refresh** control, a large score, a **change badge** (↑/↓ + value) or a
subtitle, and an optional **sub-metrics** breakdown row. Has a loading state — the
refresh icon spins until the bound data updates.

> Migrated from the legacy `OLDER COMPONENTS/card-tile-visualization`
> (`kpi-metric-card`), **UI preserved**. This is distinct from the existing
> `metric-card` component (left untouched).

## Built from standard components

| Element | Standard component | Notes |
| --- | --- | --- |
| Card container | `now-card` | `interaction="none"` (see below) + token-themed border |
| Refresh icon | `now-icon` | `refresh-outline`, `spin` bound to the loading state |

`now-card` uses `interaction="none"` on purpose: the tile has **inner** interactive
elements (refresh, sub-metrics), and now-card's interactive overlay button would
otherwise swallow their clicks. The card-level click is handled on the inner wrapper,
with inner buttons calling `stopPropagation` — matching the legacy behaviour.

The icon box, score, change badge and sub-metrics row are **owned markup** (documented
§5 — no DS components match). Colours are documented hex matching the legacy design;
the raw-hex colour props were dropped (defaults unchanged), per the survey-version-item
approach.

> **§3.1 Horizon-only:** the deployed entry does **not** import `now-*` — the instance
> supplies the Horizon versions via `innerComponents`; imported only in `example/`.

## Properties

`title`, `singleScore`, `changeValue`, `changeLabel`, `variant` (positive/negative/
neutral), `showRefresh`, `subtitle`, `showChangeRow`, `showArrow`, `showIcon`,
`iconContent`, `subMetricsJson` (JSON array of `{ label, value, previousValue }`).

## Events

| Event | Payload | When |
| --- | --- | --- |
| `KPI_CARD_CLICKED` | `{ title, singleScore }` | Card clicked (ignored while loading). |
| `KPI_REFRESH_REQUESTED` | `{ title }` | Refresh clicked — re-bind data; updating a data prop clears loading. |
| `KPI_SUBMETRIC_CLICKED` | `{ label, value, index }` | A sub-metric column clicked. |

## Develop / deploy

```bash
npm run develop      # local playground (now-* render in legacy styling)
npm run deploy       # snc ui-component deploy
npm test             # logic tests
```
