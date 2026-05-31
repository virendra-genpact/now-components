# Collapse / Expand Panel (`x-gegis-library-collapse`)

A fully custom, self-contained collapsible panel for ServiceNow Next Experience
(UI Builder). A clickable header with a chevron or +/- trigger shows or hides its
content. Stack several panels to build an accordion.

## Why this is a custom-from-scratch component (per the dev rules §1/§3)

The Horizon design system ships `now-collapse` and `now-accordion`, but neither
provides a single, self-contained, UI-Builder-droppable collapsible panel:

- **`now-accordion` is not available in UI Builder.** Its own Horizon docs state it
  is available "when creating custom components. It's not included in UI Builder."
- **`now-collapse` is a behavior utility**, not a panel. It requires a separate
  *collapse trigger* and a host container, and has no built-in header/label. You
  cannot drop it on a page and get a working titled section.

This component fills that gap. It uses **zero `now-*` dependencies**, so it cannot
hit the bundling / `process is not defined` / instance-icon-library issues that
affect composed components, and it themes purely through Now design tokens
(`--now-color--*`, `--now-font-family`) with safe fallbacks — no shadow-DOM
piercing, no hardcoded brand colors.

> If you later want the official look, this panel can be refactored to compose
> `now-collapse` + a collapse trigger inside a container. The public properties
> below are designed to survive that change.

## Properties

| Property | Type | Default | Description |
| --- | --- | --- | --- |
| `headingText` | string | `Section title` | Header label; selecting it toggles the panel. |
| `bodyText` | string | (sample text) | Fallback content shown when the `content` slot is empty. |
| `expanded` | boolean | `false` | Whether the panel starts open. |
| `triggerIcon` | choice | `chevron` | `chevron` or `plusminus`. |
| `iconPosition` | choice | `right` | `right` or `left`. |
| `bordered` | boolean | `false` | Off = flat/borderless (default). On = rounded card border. |
| `disabled` | boolean | `false` | When on, the header can't be toggled. |
| `contentSizing` | choice | `grow` | `grow` (area grows with content; `contentHeight` is a min floor) or `fixed` (exact height, scrolls inside). |
| `contentHeight` | string | `60vh` | CSS length. Min height in `grow` mode, exact height in `fixed` mode. Needed for fill-parent content like a Playbook. |

## Events

| Event | Payload | When |
| --- | --- | --- |
| `COLLAPSE_TOGGLED` | `{ expanded, heading }` | The panel is expanded or collapsed. |

## Slot

A named **`content`** slot holds the panel body — it's the drop zone in UI Builder.
Drop a Playbook (or any components) into it. `bodyText` is shown only when the slot
is empty. For fill-parent content like a Playbook, set `contentHeight` (e.g. `60vh`)
so it renders at a usable height — see Properties above.

## Changing scope (deploy to any PDI)

Scope is managed **project-wide** from the monorepo root (default `x_gegis_library`,
stored in the root `scope.config.json`). To deploy into a PDI that doesn't have that
scope, retarget to a scope that exists there — run from the **repo root**:

```bash
# this component only:
npm run set-scope -- x_acme_lab collapse
cd components/collapse && npm run deploy

# reset back to the project default:
npm run set-scope -- x_gegis_library collapse
```

The element tag follows the scope automatically (`x_acme_lab` → `x-acme-lab-collapse`).
The script keeps `package.json`, `now-ui.json`, `src/`, imports and the element folder
consistent. Don't hand-edit the scope — use `set-scope`. See the
[monorepo README](../../README.md#changing-scope-deploy-to-any-pdi) for full usage.

## Develop / test / deploy

```bash
npm install
npm run develop      # live playground (auto-generated from now-ui.json)
npm run develop:au   # preview against the Australia instance
npm test             # snc ui-component test
npm run deploy       # snc ui-component deploy
```

## Accessibility

- The header is a real `<button>` — focusable and operable with Enter/Space.
- `aria-expanded` reflects state; `aria-controls` links the header to the content
  region (`role="region"`), which is `hidden` when collapsed.
- The trigger icon is `aria-hidden`; the heading text is the accessible name.
