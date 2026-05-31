# Endorsement Card (`x-gegis-library-endorsement-card`)

A single endorsement / clause card: title, colored category pills, description,
gray meta tags, and an action button that covers **all action types**. 100%
custom, **zero `now-*` deps**; chevron + pills in pure CSS. Drop several to build a
clause-library grid.

## Action types (`actionType`)

| value | Button | Behavior |
| --- | --- | --- |
| `required` | gray, disabled **Required** | no event (locked) |
| `add` | blue **+ Add** | fires `ACTION_CLICKED { type: 'add' }` |
| `remove` | red **× Remove** | fires `ACTION_CLICKED { type: 'remove' }` |
| `none` | (no button) | — |

## Pills & tags

- **`categoryTags`** — colored pills: `{ label, color }`, color ∈ `blue` (ISO),
  `red` (Mandatory), `green` (Applied), `purple` (Proprietary), `orange`, `gray`.
- **`metaTags`** — plain gray tags: array of strings or `{ label }`
  (e.g. `Auto-applied`, `Suggested`, `Requires approval`).

```json
{
  "title": "Additional Insured - Owners, Lessees or Contractors",
  "categoryTags": [{ "label": "ISO", "color": "blue" }, { "label": "Applied", "color": "green" }],
  "description": "Extends coverage to additional parties per written contract",
  "metaTags": ["Suggested"],
  "actionType": "remove"
}
```

## Properties

| Property | Type | Default | Description |
| --- | --- | --- | --- |
| `title` | string | `Commercial General Liability Coverage` | Clause name. |
| `categoryTags` | json | `[]` | Colored pills `{ label, color }`. |
| `description` | string | `''` | Text under the pills. |
| `metaTags` | json | `[]` | Gray tags (strings or `{ label }`). |
| `actionType` | choice | `required` | `required` / `add` / `remove` / `none`. |
| `actionLabel` | string | `''` | Override button text (else default per type). |
| `collapsible` | boolean | `false` | When on, the chevron toggles the body. |
| `expanded` | boolean | `true` | Start open when collapsible. |

## Events

| Event | Payload |
| --- | --- |
| `ACTION_CLICKED` | `{ type }` (`add` or `remove`) |
| `TOGGLED` | `{ expanded }` (collapsible only) |

## Develop / deploy

```bash
npm install
npm run develop      # playground (port 8086); switch actionType to see all states
npm run deploy
```

> Scope is managed project-wide; see the [monorepo README](../../README.md#changing-scope-deploy-to-any-pdi).
