# Now Components Monorepo

This repository hosts multiple ServiceNow custom components as a single monorepo.

- Components live in `components/<component-name>`.
- Each component is an independent package and can be published separately.

Quick start

1. Install dependencies:

```
cd now-components
npm install
```

2. Add a new component using the template in `components/component-template` (see CONTRIBUTING).

3. Build a component:

```
cd components/<your-component>
npm run build
```

4. Publish: see the **Publishing** section in this README and `.github/workflows/publish.yml`.

Publishing (summary)

We recommend publishing packages to GitHub Packages or an npm registry. Configure `publishConfig` in each package and set repository secrets (`NPM_TOKEN` or `GH_TOKEN`) for CI to publish.

For full instructions see CONTRIBUTING.md.