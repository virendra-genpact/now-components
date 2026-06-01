# Selected Product Summary — `x-gegis-library-selected-product`

A "selected product" summary bar for ServiceNow **Next Experience** (UI Builder):
an icon, the product name (with a star indicator) and a subtitle, plus a **Change
Product** action. Clicking it opens a **confirmation modal** (the change is
irreversible); confirming emits an event so the page can archive existing quote
options and return to product selection.

```
┌────────────────────────────────────────────────────────────────────────────┐
│  🛡  Product: Commercial Property – Standard Plan  ★        [ Change Product ]│
│      Base limits and clauses applied from selected product                   │
└────────────────────────────────────────────────────────────────────────────┘
        ┌───────────────────────────────────────────────┐
        │  ⚠  Change Product                          ✕ │
        │     Changing the product will archive all      │
        │     existing quote options. This action        │
        │     cannot be undone.                           │
        │                              [ Cancel ] [Continue]│
        └───────────────────────────────────────────────┘
```

## Built from standard components

| Element | Standard component | Notes |
| --- | --- | --- |
| Shield + star + warning glyphs | `now-icon` | `icon` / `starIcon` / `confirmIcon` |
| Change Product action | `now-button` | `variant="secondary"` |
| Confirmation dialog | `now-modal` | `size="sm"`, `headerLabel`, message slot, `footerActions` |

The **bar layout** itself is owned markup (documented §5 exception — no DS component
reproduces this product-summary row); it's styled with design tokens, and never pierces
a composed component's shadow DOM.

> **§3.1 Horizon-only:** the deployed entry (`src/index.js`) does **not** import the
> `now-*` source — the instance supplies the Horizon versions via `innerComponents`.
> The `now-*` are imported only in `example/element.js` for the local playground.

## Properties

| Property | Type | Default |
| --- | --- | --- |
| `productPrefix` | string | `Product:` |
| `productName` | string | `Commercial Property – Standard Plan` |
| `subtitle` | string | `Base limits and clauses applied from selected product` |
| `icon` | string | `shield-outline` |
| `showStar` | boolean | `true` |
| `starIcon` | string | `star-fill` |
| `changeButtonLabel` | string | `Change Product` |
| `confirmHeader` | string | `Change Product` |
| `confirmMessage` | string | `Changing the product will archive all existing quote options. This action cannot be undone.` |
| `confirmIcon` | string | `circle-exclamation-outline` |
| `confirmLabel` | string | `Continue` |
| `cancelLabel` | string | `Cancel` |

> Icon names must be valid `now-icon` names (else they render blank). Use the UI Builder
> icon picker or the now-icon gallery to confirm.

## Events

Declared in `now-ui.json` under **`actions`** (the key UI Builder reads) so they appear
in the Events tab — see `SERVICENOW_CUSTOM_COMPONENT_DEV_RULES.md` §9.

| Event | Payload | When |
| --- | --- | --- |
| `CHANGE_PRODUCT_REQUESTED` | `{ productName }` | Change Product clicked (modal opens). |
| `CHANGE_PRODUCT_CONFIRMED` | `{ productName }` | User confirms in the modal — archive options + go to selection. |
| `CHANGE_PRODUCT_CANCELLED` | `{}` | User cancels or dismisses (X / Escape). |

Footer buttons carry distinct `clickActionType`s (`SPB_CONFIRM` / `SPB_CANCEL`), so each
dispatches its own action type — no payload disambiguation needed.

## Develop / deploy

```bash
npm run develop      # local playground (now-* render in legacy styling)
npm run deploy       # snc ui-component deploy (instance supplies Horizon now-*)
npm test             # logic tests
```

> Local `snc develop` shows the controls in **legacy** styling (bundled npm `now-*` via
> `example/`). Validate the true **Horizon** look on the instance, where the deployed
> component uses the instance-provided `now-*`.
