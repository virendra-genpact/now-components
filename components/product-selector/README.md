# Product Selector — `x-gegis-library-product-selector`

A single-select (**radio**) group of product cards for ServiceNow **Next Experience**.
Each option shows a **radio dot**, a **title**, an optional **subtitle + checkmark
bullets**, and a **pill** (e.g. "AI Recommended", "Higher Protection").

```
( ) Commercial Property – Standard Plan          [ AI Recommended ]
    Why we recommend:
    ✓ Matches industry: Manufacturing
    ✓ Covers key risks: Fire, Machinery
( ) Flood Insurance                              [ Higher Protection ]
( ) Business Interruption                        [ Lower Premium ]
```

## Built per the rules

Composes standards (see
[SERVICENOW_CUSTOM_COMPONENT_DEV_RULES.md](../../../SERVICENOW_CUSTOM_COMPONENT_DEV_RULES.md)):
**`now-card`** (each selectable card) and **`now-icon`** (green checkmarks, optional
pill icon). Documented §5 exceptions — the **radio dot** (no hollow-circle glyph) and
the **pill** (`now-highlighted-value` renders a flat rectangle with no settable
radius/padding) are owned + styled as a rounded capsule. The radiogroup/radio roles,
keyboard support, single-select state, and title/subtitle/bullet text are managed/
owned by the component.

## Properties

| Property | Type | Default | Description |
| --- | --- | --- | --- |
| `options` | json (array) | 3 sample products | Each: `{ id, title, subtitle, bullets:[], pill, pillTone, pillIcon }`. |
| `value` | string | `commercial` | The selected option's `id`. |
| `bulletsWhenSelectedOnly` | boolean | `true` | Show subtitle + bullets only on the selected card. |

**Option object**

| Key | Description |
| --- | --- |
| `id` | Unique id (used as the selected `value`). Required. |
| `title` | Card title. |
| `subtitle` | Small bold heading above the bullets (e.g. "Why we recommend:"). |
| `bullets` | Array of strings rendered with green checkmarks. |
| `pill` | Pill label (right-aligned). |
| `pillTone` | `info` (blue) · `neutral` (gray) · `positive` · `warning` · `error`. |
| `pillIcon` | Optional `now-icon` glyph shown inside the pill. |

### Events

| Event | Payload | When |
| --- | --- | --- |
| `PRODUCT_SELECTED` | `{ value }` | The user selects a different option. |

## Accessibility

The group uses `role="radiogroup"`; each card is `role="radio"` with `aria-checked`,
is focusable, and responds to **Enter/Space**.

## Develop

```bash
cd components/product-selector
npm install
npm run develop        # or develop:au for the Australia profile
```

> `snc develop` previews against the public-npm (Rome-era) `now-*`; validate the
> final Horizon look on your instance.
