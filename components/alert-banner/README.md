# Alert Banner — `x-gegis-library-alert-banner`

A tinted status / alert banner for ServiceNow **Next Experience** (UI Builder), with
four variants — **info**, **warning**, **critical** and a distinct **AI** variant
(indigo sparkle + label + body). Supports an icon circle, title, timestamp subtitle
(with a clock glyph), bold detail lines, body text and an optional clickable link.

```
┌────────────────────────────────────────────────────────────┐
│ (i)  Submission Details                                      │
│      1 entity requires compliance review. Workflow cannot…   │
└────────────────────────────────────────────────────────────┘
  AI variant:  ✦ AI Quick Assessment: <body text>
```

> Migrated from the legacy `OLDER COMPONENTS/alert-banner`, **UI preserved verbatim**.

## Custom by design (documented §0/§5 exception)

This component is **100% owned markup with zero `now-*` dependencies** — like
`endorsement-card` / `collapse`. `now-alert` is a fixed-layout status banner and cannot
reproduce this design: the **tinted icon circle**, the **AI sparkle variant**, the
**bold detail lines** and the **clock subtitle**. Variant colours are documented hex
matching the legacy design. Glyphs are injected as HTML strings via `props={{innerHTML}}`
(the sanctioned non-JSX SVG pattern).

## Properties

| Property | Type | Default |
| --- | --- | --- |
| `variant` | choice | `info` (info / warning / critical / ai) |
| `title` / `showTitle` | string / boolean | `Submission Details` / `true` |
| `subtitle` / `showSubtitle` | string / boolean | timestamp / `false` |
| `bodyText` / `showBodyText` | string / boolean | compliance message / `true` |
| `detailLine1` / `detailLine2` / `showDetailLines` | string / string / boolean | `IronClad Inc.` / address / `false` |
| `linkText` / `showLinkText` | string / boolean | record-match prompt / `false` |
| `showIcon` | boolean | `true` |
| `aiLabel` | string | `AI Quick Assessment:` |

## Events

| Event | Payload | When |
| --- | --- | --- |
| `ALERT_BANNER_LINK_CLICKED` | `{ linkText, variant }` | The banner's link text is clicked. |

## Develop / deploy

```bash
npm run develop      # local playground
npm run deploy       # snc ui-component deploy
npm test             # logic tests
```
