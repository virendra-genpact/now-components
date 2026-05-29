# Now Components Monorepo

A collection of **ServiceNow Next Experience** custom components (UI Builder),
each an independent, deployable package built with `@servicenow/ui-core` and the
snabbdom renderer.

## Components

| Component | Element tag | Description |
| --- | --- | --- |
| [`metric-card`](components/metric-card) | `x-gegis-library-metric-card` | Configurable KPI card — icon, heading, formatted value, and trend pill. |
| [`component-template`](components/component-template) | `x-vendor-component-template` | Copy-me starter for new components. |

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

## Add a new component

Copy `components/component-template` and follow the rename + develop steps in
[CONTRIBUTING.md](CONTRIBUTING.md).

## Publishing

Each component declares `publishConfig`. CI (`.github/workflows/publish.yml`)
publishes every workspace on a `v*` tag or manual dispatch — set the `NPM_TOKEN`
(or `GH_TOKEN`) repository secret first. See CONTRIBUTING.md for details.
