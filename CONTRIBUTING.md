# Contributing: Add a new component

Components are **ServiceNow Next Experience** custom elements (built with
`@servicenow/ui-core` + snabbdom) and are developed/deployed with the global
ServiceNow CLI, `snc`.

## Prerequisites

```bash
npm i -g @servicenow/cli      # provides `snc`
node -v                       # >= 22
snc configure profile         # point snc at your instance (one-time)
```

## 1. Copy an existing component

Start from a working component — `collapse` is a clean, dependency-free example:

```bash
cp -r components/collapse components/my-component
cd components/my-component
```

## 2. Rename identifiers

Replace the copied component's name and element tag everywhere (`package.json`,
`now-ui.json`, `src/**`, `example/**`) **and** rename the `src/<tag>/` folder to
match your new element tag:

| From (copied) | Replace with | Example |
| --- | --- | --- |
| base name `collapse` | your component name | `my-component` |
| element tag `x-gegis-library-collapse` | `x-<scope>-<name>` | `x-gegis-library-my-component` |

> The element tag **must** begin with your scope (underscores → hyphens).
> Scope `x_gegis_library` → tag `x-gegis-library-…`. UI Builder rejects tags that
> don't match the scope.

Also update `package.json` `name`, `version`, `description` and the `now-ui.json`
`label` / `description` / `category`, and clear out the example component's
`properties` / `view` to start fresh.

> To retarget the **scope** (not the name) across components for a different PDI,
> use `npm run set-scope` from the repo root — see the [README](README.md#changing-scope-deploy-to-any-pdi).

## 3. Implement

- `src/<tag>/index.js` — `createCustomElement(...)`: `view`, `properties`,
  `actionHandlers`.
- `src/<tag>/styles.scss` — scoped styles (`@import '@servicenow/sass-kit/host';`).
- `now-ui.json` `properties[]` — the config panel surfaced in UI Builder. Every
  configurable field (title, icon, value, …) belongs here **and** in the
  component's `properties` map so it has a runtime default.

## 4. Develop & test locally

```bash
npm install
npm run develop   # snc ui-component develop — serves example/element.js
npm test          # snc ui-component test
```

`npm run develop` opens an **auto-generated live playground** (from
`example/playground.js`) that reads your `now-ui.json` and renders a control for
every declared property — so you can tune the component in real time without
writing any harness code. Describe each field in `now-ui.json` `properties[]` and it
shows up automatically.

## 5. Deploy to an instance

```bash
npm run deploy    # snc ui-component deploy
```

## 6. Publish (optional, source distribution)

To distribute the component source via a registry, push a `v*` tag or run the
**Publish component** workflow (`.github/workflows/publish.yml`). Set the
`NPM_TOKEN` (or `GH_TOKEN`) repository secret first, and confirm each component's
`publishConfig.registry`.
