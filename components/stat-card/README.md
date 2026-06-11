# Stat Card — `x-gegis-library-stat-card`

A compact stat / KPI card for ServiceNow **Next Experience** (UI Builder): a muted
label over a large value, coloured by a **severity variant**. Optionally tints the card
background with the variant's soft colour. Clicking the card emits an event.

```
┌──────────────────────┐
│  Total Locations     │
│  72                  │   ← value coloured by variant (red/orange/amber/green/gray)
└──────────────────────┘
```

> Migrated from the legacy `OLDER COMPONENTS/stat-card`. Composes `now-card`
> (container + click + a11y); the label/value typography and severity palette are owned
> markup (documented §5 — no DS "big number" component matches). The legacy raw-hex
> colour props were dropped (defaults unchanged), per the survey-version-item approach.

## Built from standard components

| Element | Standard component | Notes |
| --- | --- | --- |
| Card container | `now-card` | `interaction="click"`, `hideShadow` + token-themed hairline border |

> **§3.1 Horizon-only:** the deployed entry does **not** import the `now-*` source —
> the instance supplies the Horizon version via `innerComponents`; `now-card` is
> imported only in `example/element.js` for the local playground.

## Properties

| Property | Type | Default |
| --- | --- | --- |
| `label` | string | `Total Locations` |
| `value` | string | `72` |
| `variant` | choice | `critical` (critical / major / moderate / minor / insignificant) |
| `useVariantBackground` | boolean | `false` |

## Events

| Event | Payload | When |
| --- | --- | --- |
| `STAT_CARD_CLICKED` | `{ label, value, variant }` | Card clicked. |

## Develop / deploy

```bash
npm run develop      # local playground (now-card renders in legacy styling)
npm run deploy       # snc ui-component deploy (instance supplies Horizon now-card)
npm test             # logic tests
```
