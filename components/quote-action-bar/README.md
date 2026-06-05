# Quote Options Action Bar — `x-gegis-library-quote-action-bar`

A toolbar for a set of quote options. **Select All** toggles the whole set; **Approve
Selected** and **Share to Broker** enable only when one or more are selected; **Generate
New Option** is always available.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ [ Select All ]  2 of 4 selected        [✓ Approve Selected] [➤ Share] [＋ Generate] │
└──────────────────────────────────────────────────────────────────────────────────┘
```

The component **holds the selection (`selected` ids) and emits events** — it does no
data work itself. Wire the events on the page to do the real actions.

## Built from standard components

| Element | Standard component |
| --- | --- |
| All four buttons | `now-button` (`variant` + `icon` + `disabled`) |
| Button icons | `now-icon` (via `now-button`'s `icon`) |

The toolbar layout is owned markup (documented §5); styled with design tokens, no
shadow-DOM piercing.

> **§3.1 Horizon-only:** `src/index.js` does **not** import the `now-*` source — the
> instance supplies the Horizon versions via `innerComponents`. The `now-*` are imported
> only in `example/element.js` for the local playground.

## Properties

| Property | Type | Default |
| --- | --- | --- |
| `options` | json | `{ items: [{id,label} ×4] }` — defines N and the ids Select All selects |
| `selectedIds` | json | `{ ids: [] }` — initial / externally-bound selection |
| `showCount` | boolean | `true` — show "X of N selected" |
| `selectAllLabel` | string | `Select All` |
| `deselectAllLabel` | string | `Deselect All` (shown when all selected; set equal to keep constant) |
| `approveLabel` | string | `Approve Selected` |
| `shareLabel` | string | `Share to Broker` |
| `generateLabel` | string | `Generate New Option` |
| `approveIcon` / `shareIcon` / `generateIcon` | string | `circle-check-outline` / `share-outline` / `plus-outline` |

> Icon names must be valid `now-icon` names (else blank) — confirm in the UIB icon picker.

## Events

Declared under **`actions`** (UI Builder reads this; see rules §9), so they appear in the
Events tab.

| Event | Payload | When |
| --- | --- | --- |
| `SELECTION_CHANGED` | `{ selected:[ids], count }` | Select All toggles the selection |
| `APPROVE_SELECTED` | `{ selected:[ids] }` | Approve clicked (only when 1+ selected) |
| `SHARE_TO_BROKER` | `{ selected:[ids] }` | Share clicked (only when 1+ selected) |
| `GENERATE_NEW_OPTION` | `{}` | Generate clicked (always) |

Each button has its own wrapper click handler (no shared `NOW_BUTTON#CLICKED` to
disambiguate); Approve/Share are guarded so a click while disabled does nothing.

## Develop / deploy

```bash
npm run develop   # local playground (now-* render in legacy styling)
npm run deploy    # snc ui-component deploy (instance supplies Horizon now-*)
npm test          # logic tests
```
