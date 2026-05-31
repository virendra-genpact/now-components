# Now Components Monorepo

A collection of **ServiceNow Next Experience** custom components (UI Builder),
each an independent, deployable package built with `@servicenow/ui-core` and the
snabbdom renderer.

## Components

| Component | Element tag | Description |
| --- | --- | --- |
| [`metric-card`](components/metric-card) | `x-gegis-library-metric-card` | Configurable KPI card — icon, heading, formatted value, and trend pill. |
| [`product-selector`](components/product-selector) | `x-gegis-library-product-selector` | Radio group of product cards (title, bullets, pill) — composes `now-card` + `now-highlighted-value` + `now-icon`. |
| [`collapse`](components/collapse) | `x-gegis-library-collapse` | Fully custom flat/borderless expand–collapse **container** with a named `content` slot — drop a Playbook (or anything) inside. Supports grow-to-fit or fixed content height. |

## Layout

- Components live in `components/<component-name>`.
- Each component is a self-contained ServiceNow component project (`now-ui.json`,
  `now-cli.json`, `src/`, `example/`) and is published / deployed separately.
- The repo is an npm workspace, so `npm install` at the root bootstraps every
  component.

## Prerequisites

```bash
npm i -g @servicenow/cli      # the `snc` CLI used to develop & deploy
node -v                       # >= 22
```

## Quick start

```bash
# 1. Bootstrap all workspaces
npm install

# 2. Work on a component (local preview + example harness)
cd components/metric-card
npm run develop               # snc ui-component develop

# 3. Deploy it to your instance
npm run deploy                # snc ui-component deploy
```

## Changing scope (deploy to any PDI)

The default application scope is **`x_gegis_library`**, stored once at the repo root
in **`scope.config.json`**. A PDI usually won't let you create that scope, so to
deploy there you retarget to a scope that **already exists** in that PDI. ServiceNow
ties the element tag to the scope (`x_gegis_library` → `x-gegis-library-<name>`), so
the scope appears in many files per component. The project-level `set-scope` script
rewrites all of them — across **every** component — from one value.

Run it from the **repo root**:

```bash
# Preview what would change (writes nothing):
npm run set-scope -- --dry x_acme_lab

# Retarget ALL components to a scope that exists in the PDI:
npm run set-scope -- x_acme_lab

# …or just one component:
npm run set-scope -- x_acme_lab collapse

# Deploy each component:
cd components/collapse && npm run deploy

# Reset everything back to the project default when finished:
npm run set-scope -- x_gegis_library
```

For each component the script rewrites `package.json` (name), `now-ui.json`
(`scopeName` + tag key), the `createCustomElement` tag, the import paths, and renames
the element folder — keeping them consistent. **Don't hand-edit the scope** in
individual files; always use `set-scope`.

> Note: running without a component name retargets **all** components, including
> `metric-card` and `product-selector`. Use `--dry` first, or pass a single
> component name, if you only mean to change one.

## Add a new component

Copy an existing component (e.g. `components/collapse`) as a starting point and
follow the rename + develop steps in [CONTRIBUTING.md](CONTRIBUTING.md).

## Publishing

Each component declares `publishConfig`. CI (`.github/workflows/publish.yml`)
publishes every workspace on a `v*` tag or manual dispatch — set the `NPM_TOKEN`
(or `GH_TOKEN`) repository secret first. See CONTRIBUTING.md for details.
