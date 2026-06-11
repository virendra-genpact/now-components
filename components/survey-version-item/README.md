# Survey Version Item — `x-gegis-library-survey-version-item`

A single row in a survey **version-history** list for ServiceNow **Next Experience**
(UI Builder): a status icon, the version title with an optional **LATEST** badge, and a
muted meta line (created date + trigger reason). Clicking the row emits an event.

```
┌────────────────────────────────────────────────────────────────────────────┐
│  ✓  Survey Result -V3   [ LATEST ]                                           │
│     Created: 2026-02-25 16:14:33 • Triggered by: Addition of new property    │
└────────────────────────────────────────────────────────────────────────────┘
```

> Migrated from the legacy `OLDER COMPONENTS/survey-version-item` (raw HTML/CSS,
> inline-SVG icon, per-element hex colour props) into the library scope, composing
> standard components and design tokens.

## Built from standard components

| Element | Standard component | Notes |
| --- | --- | --- |
| Row container | `now-card` | `interaction="click"` (when `clickable`) → border/surface, click + a11y |
| Status glyph | `now-icon` | `completedIcon` / `pendingIcon` (e.g. `circle-check-fill` / `circle-check-outline`) |

**Owned markup (documented §5 exception):** the title-row + muted meta-line typography,
and the **LATEST badge** — `now-badge` is numeric-only and `now-pill` is a dismissible
filter control, so neither models a small static status label. The badge is an owned
`<span>` whose colour comes from a token-driven `badgeColor` choice. Nothing pierces a
composed component's shadow DOM.

**Dropped vs the legacy component:** the raw-hex colour properties (`iconColor`,
`badgeBackgroundColor`, `badgeTextColor`, `titleColor`, `metaColor`, `backgroundColor`,
`borderColor`). The card surface/border come from `now-card`'s tokens, the icon colour
follows the completed/pending status token, and the badge colour is the token-themed
`badgeColor` choice — per §5 (no hardcoded-hex props).

> **§3.1 Horizon-only:** the deployed entry (`src/index.js`) does **not** import the
> `now-*` source — the instance supplies the Horizon versions via `innerComponents`.
> The `now-*` are imported only in `example/element.js` for the local playground.

## Properties

| Property | Type | Default |
| --- | --- | --- |
| `itemTitle` | string | `Survey Result -V3` |
| `showLatestBadge` | boolean | `true` |
| `latestBadgeLabel` | string | `LATEST` |
| `badgeColor` | choice | `positive` (positive / info / warning / critical / neutral) |
| `createdLabel` | string | `Created:` |
| `createdDate` | string | `2026-02-25 16:14:33` |
| `triggeredByLabel` | string | `Triggered by:` |
| `triggeredByValue` | string | `Addition of new property` |
| `showStatusIcon` | boolean | `true` |
| `isCompleted` | boolean | `true` |
| `completedIcon` | string | `circle-check-fill` |
| `pendingIcon` | string | `circle-check-outline` |
| `clickable` | boolean | `true` |
| `hideShadow` | boolean | `true` (flat row; turn off for a raised card) |

> Icon names must be valid `now-icon` names (else they render blank). Use the UI Builder
> icon picker or the now-icon gallery to confirm.

## Events

Declared in `now-ui.json` under **`actions`** (the key UI Builder reads) so they appear
in the Events tab — see `SERVICENOW_CUSTOM_COMPONENT_DEV_RULES.md` §9.

| Event | Payload | When |
| --- | --- | --- |
| `SURVEY_VERSION_ITEM_CLICKED` | `{ itemTitle, createdDate, isCompleted }` | Row clicked (only when `clickable` is on). |

## Develop / deploy

```bash
npm run develop      # local playground (now-* render in legacy styling)
npm run deploy       # snc ui-component deploy (instance supplies Horizon now-*)
npm test             # logic tests
```

> Local `snc develop` shows the controls in **legacy** styling (bundled npm `now-*` via
> `example/`). Validate the true **Horizon** look on the instance, where the deployed
> component uses the instance-provided `now-*`.
