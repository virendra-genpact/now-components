# Contributing: Add a new component

1. Create a new folder under `components/` with a short, kebab-case name.

2. Copy the template folder: `components/component-template` -> `components/my-component`.

3. Update `package.json` inside your component:
   - Set `name` to a unique package name (use your organization scope for GitHub Packages, e.g. `@my-org/my-component`).
   - Update `version`, `description`, `repository` fields.

4. Implement your source in `src/` and update `scripts.build` as needed.

5. Locally test and build:

```
cd components/my-component
npm install
npm run build
```

6. Commit and push. To publish via CI, create a Release or a tag (depends on workflow), and ensure repository secrets are set (`NPM_TOKEN` or `GH_TOKEN`).
