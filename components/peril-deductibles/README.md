# Peril-Specific Deductibles — `x-gegis-library-peril-deductibles`

A collapsible **Peril-Specific Deductibles** editor for ServiceNow **Next
Experience** (UI Builder). A header (title + live override count + collapse
chevron) over a list of perils; each row has a category tag, an override
toggle, a value field, and a unit dropdown.

```
┌────────────────────────────────────────────────────────────────┐
│  Peril-Specific Deductibles   3 overrides applied            ⌄  │
├────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Wind / Hurricane *  [Coastal Zone]        (•)  [ 2 ] [% TIV▾]│ │
│  │ Default: 2% of TIV                                          │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Flood *  [Flood Zone A]                   (•)  [ 5 ] [% TIV▾]│ │
│  │ Default: 5% of TIV                                          │ │
│  └────────────────────────────────────────────────────────────┘ │
│  … Earthquake (off, fields disabled) … Hail (on) …               │
└────────────────────────────────────────────────────────────────┘
```

## Built from standard components (per [SERVICENOW_CUSTOM_COMPONENT_DEV_RULES.md](../../../SERVICENOW_CUSTOM_COMPONENT_DEV_RULES.md))

Every visual element is a **standard `now-*` component**, customized only through
its documented properties — nothing is hand-rolled to recreate a default:

| Element | Standard component | Key props used |
| --- | --- | --- |
| Card container | `now-card` | (chrome: border / radius / shadow / bg) |
| Header rule | `now-card-divider` | `full-width`, `block-spacing="none"` |
| Blue category tag | `now-highlighted-value` | `color="blue"`, `variant="tertiary"`, `label` |
| Override switch | `now-toggle` | `checked`, `configAria` |
| Value field | `now-input` | `type="number"`, `align="start"`, `name`, `value`, `disabled` |
| Unit picker | `now-dropdown` | `select="single"`, `items`, `selectedItems`, `disabled` |
| Collapse chevron | `now-icon` | `icon="chevron-down-outline"` |

> **`now-badge`** was **not** used for the tag — it is numeric-only ("indicates a
> total count"). `now-highlighted-value` is the design-system "colored
> status/category label" and is the correct fit.
>
> **`now-select`** is the *semantic* component for the unit picker, but its
> public-npm (Rome-era) source SCSS multiplies a `rem` by a CSS `var()`
> (`$now-form-field--height-scale`), which **Dart Sass cannot compile** — it
> breaks both `develop` and `deploy` in this toolchain (the instance ships a
> prebuilt build that never hits this). `now-dropdown` with `select="single"` is
> the next-best **standard** picker: it bundles cleanly and its trigger shows the
> selected unit label with a caret.

### Owned markup (documented §5 exception)

Only **layout + typography that has no design-system equivalent** is owned and
styled in `styles.scss` using design tokens:

- the **header bar** (inline title + override count + chevron, click-to-collapse), and
- the **per-row two-column layout** (name / required `*` / default caption on the
  left, controls on the right) on a soft row surface.

We never pierce a composed component's shadow DOM and use no hardcoded colors
where a token exists (hex values are fallbacks for the Rome-era local preview).

## Properties

| Property | Type | Default | Description |
| --- | --- | --- | --- |
| `title` | string | `Peril-Specific Deductibles` | Header heading. |
| `expanded` | boolean | `true` | Whether the list is shown; the chevron toggles it at runtime. |
| `showOverrideCount` | boolean | `true` | Show "N overrides applied" in the header. |
| `unitOptions` | json | `{ items: [% TIV, $ Amount, % Limit] }` | Choices for each row's unit dropdown. |
| `perils` | json | 4 sample perils | The rows: `{ items: [{ id, name, required, zone, defaultText, enabled, value, unit }] }`. |

> **JSON defaults are object-wrapped (`{ items: [...] }`), never a bare array.**
> A top-level array default for a `fieldType:"json"` property breaks the
> production build (`Invalid character in name: 0`).

## Events

| Event | Payload | When |
| --- | --- | --- |
| `PERIL_DEDUCTIBLE_CHANGED` | `{ id, name, enabled, value, unit }` | A row's toggle, value, or unit changes. |

Row identity is carried explicitly (never inferred from ambiguous payloads): the
toggle via a wrapper `on-click` closure, the input via its `name`, and the select
via option ids encoded `${rowId}|${unitId}`.

## Develop / deploy

```bash
npm run develop      # local playground (auto-generated from now-ui.json)
npm run develop:au   # preview against an Australia (Horizon) instance
npm run deploy       # snc ui-component deploy
npm test             # logic tests
```

> **Local preview caveat:** `snc develop` resolves the **public-npm (Rome-era)**
> `now-*` packages, which look different from your instance's **Horizon**
> versions (spacing, the form-field label box, tag shade, toggle/track colors).
> The owned layout renders consistently everywhere; **validate final pixel
> fidelity on the Australia instance**, where the instance supplies the Horizon
> components this component composes.
