# Metric Card — `x-gegis-library-metric-card`

A configurable KPI / metric card for ServiceNow **Next Experience** (UI Builder).
Renders an icon tile, a heading, a large formatted value, and an optional trend
pill — e.g. **↓ 4.2% MoM**.

```
┌──────────────────────────────────────────────┐
│  ┌────┐   Submissions to Quote Ratio          │
│  │ $  │   25.00%                               │
│  └────┘   ┌──────────┐                         │
│           │ ↓ 4.2%   │  MoM                    │
│           └──────────┘                         │
└──────────────────────────────────────────────┘
```

## Properties

Configure these from the UI Builder config panel (defined in `now-ui.json`) or as
HTML attributes (see `example/element.js`).

| Property | Type | Default | Description |
| --- | --- | --- | --- |
| `heading` | string | `Submissions to Quote Ratio` | Title shown above the value. |
| `icon` | string | `chart-line-outline` | `now-icon` glyph name. Empty hides the icon tile. |
| `value` | string/number | `25` | The headline metric. Numeric strings are parsed (`$1,250` → `1250`). |
| `format` | choice | `percent` | `percent` · `currency` · `number` · `none`. |
| `decimals` | number | `2` | Decimal places for the value and trend magnitude. |
| `currencySymbol` | string | `$` | Prefix when `format` is `currency`. |
| `trendValue` | string/number | `-4.2` | Change vs prior period. Sign drives the auto arrow; magnitude is shown. Empty hides the pill. |
| `trendDirection` | choice | `auto` | `auto` (from sign) · `up` · `down` · `flat`. |
| `trendPeriod` | string | `MoM` | Caption beside the pill (`MoM`, `YoY`, `vs last week`…). |
| `trendPositiveIsGood` | boolean | `true` | On: up is green / down is red. Off: inverted (cost, churn, latency). |
| `iconColor` | string | `""` | Optional CSS color for the icon glyph. |
| `iconBackgroundColor` | string | `""` | Optional CSS color for the icon tile. |
| `clickable` | boolean | `false` | When on, the card is focusable and emits `METRIC_CARD_CLICKED`. |

### Events

| Event | Payload | When |
| --- | --- | --- |
| `METRIC_CARD_CLICKED` | `{ heading, value }` | A clickable card is activated by click or `Enter`/`Space`. |

## Color semantics

`trendValue` magnitude is always shown as a positive number; the **sign** picks the
arrow (when `trendDirection` is `auto`). Tone is then resolved from direction +
`trendPositiveIsGood`:

| Direction | `trendPositiveIsGood: true` | `trendPositiveIsGood: false` |
| --- | --- | --- |
| up | 🟢 good | 🔴 bad |
| down | 🔴 bad | 🟢 good |
| flat | ⚪ neutral | ⚪ neutral |

So the reference design (`trendValue="-4.2"`, defaults) renders a red **↓ 4.2%**.

## Reproducing the reference design

```html
<x-gegis-library-metric-card
	heading="Submissions to Quote Ratio"
	icon="currency-dollar-outline"
	value="25"
	format="percent"
	trend-value="-4.2"
	trend-period="MoM"
></x-gegis-library-metric-card>
```

> `icon` accepts any [`now-icon`](https://developer.servicenow.com) glyph name.
> The default is `chart-line-outline`; for a currency look try
> `currency-dollar-outline`. If a glyph name doesn't exist in your instance's icon
> set the tile renders empty — swap in a valid name.

## Develop & deploy

Requires the global ServiceNow CLI: `npm i -g @servicenow/cli`.

```bash
cd components/metric-card
npm install
npm run develop   # snc ui-component develop — local preview + example/
npm run deploy    # snc ui-component deploy  — push to your instance
npm test          # snc ui-component test
```

Configure the target instance / credentials via `snc configure profile` (or the
`now-cli.json` proxy block) before deploying.
