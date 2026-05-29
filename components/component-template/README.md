# Component Template

A minimal, working **ServiceNow Next Experience** component to copy when creating a
new component. Built with `@servicenow/ui-core` + the snabbdom renderer — the same
stack the ServiceNow CLI (`snc`) scaffolds and deploys.

## Structure

```
component-template/
├── now-ui.json                  # UI Builder metadata + configurable properties
├── now-cli.json                 # snc dev-server / proxy config
├── package.json                 # deps + develop/deploy/test scripts (wrap snc)
├── example/element.js           # local preview harness
├── tile-icon/                   # icon shown in the UI Builder component palette
└── src/
    ├── index.js                 # registers the element(s)
    └── x-vendor-component-template/
        ├── index.js             # createCustomElement(...) — view + properties
        ├── styles.scss          # scoped styles (@servicenow/sass-kit/host)
        └── __tests__/index.js
```

## Copy & rename

When you copy this folder (see [`../../CONTRIBUTING.md`](../../CONTRIBUTING.md)),
find/replace these placeholders across all files **and** rename the
`src/x-vendor-component-template/` folder:

| Placeholder | Replace with | Example |
| --- | --- | --- |
| `x-vendor-component-template` | your element tag (`x-<scope>-<name>`) | `x-gegis-library-metric-card` |
| `x_vendor_scope` | your application scope | `x_gegis_library` |

> A Next Experience custom element tag **must** start with your application scope
> (underscores become hyphens). Scope `x_gegis_library` → tag `x-gegis-library-…`.

## Develop & deploy

Requires the global ServiceNow CLI: `npm i -g @servicenow/cli`.

```bash
npm install
npm run develop   # snc ui-component develop — serves example/ for local preview
npm run deploy    # snc ui-component deploy  — push the component to your instance
npm test          # snc ui-component test
```
