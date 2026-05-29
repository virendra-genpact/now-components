# Banner — `x-gegis-library-banner`

A configurable banner / callout for ServiceNow **Next Experience** (UI Builder):
an icon, a title, up to four message lines, an optional inline link, and an optional
dismiss button — themed by **type** (info / warning / error / success).

```
┌────────────────────────────────────────────────────────┐
│  ⚠  5 Potential duplicates found                         │
│     The system has identified the following submissions… │
│     Review and determine whether to proceed or decline.  │
└────────────────────────────────────────────────────────┘
```

## Built per the rules

This is a thin composition of the standard **`now-alert`** component
(see [SERVICENOW_CUSTOM_COMPONENT_DEV_RULES.md](../../../SERVICENOW_CUSTOM_COMPONENT_DEV_RULES.md)).
`now-alert` supplies the container color, icon, header, message, link, dismiss button,
and accessibility — we only map the component's properties onto it. **No custom markup.**

| Banner type | `now-alert` status | Default icon |
| --- | --- | --- |
| `info` | `info` | `circle-info-outline` |
| `warning` | `warning` | `exclamation-triangle-fill` |
| `error` | `critical` | `exclamation-triangle-fill` |
| `success` | `positive` | `check-circle-fill` |

## Properties

| Property | Type | Default | Description |
| --- | --- | --- | --- |
| `type` | choice | `warning` | `info` · `warning` · `error` · `success` — sets color + default icon. |
| `title` | string | `5 Potential duplicates found` | Bold heading (`now-alert` header). |
| `line1`–`line4` | string | (line1/2 set) | Message lines; empty lines are skipped. Supports inline icon tokens (see below). |
| `icon` | string | `""` | Optional `now-icon` glyph override; empty uses the type's default. |
| `dismissible` | boolean | `false` | Shows an (X) button; hides the banner and emits `BANNER_DISMISSED`. |
| `expandable` | boolean | `true` | When off, hides the "Show more/less" toggle and keeps the full message visible. |
| `linkLabel` | string | `""` | Inline link text (only shows when label **and** URL are set). |
| `linkHref` | string | `""` | Inline link URL. |

### Line formatting (text you can type)

Each line accepts a small, safe markup vocabulary. Everything is HTML-escaped first,
then only this allowlist is re-enabled — no arbitrary HTML or attributes:

| You type | Result |
| --- | --- |
| `<b>…</b>` | **bold** |
| `<i>…</i>` | _italic_ |
| `<u>…</u>` | underline |
| `<size=12>…</size>` | font size in px (digits only) |
| `:icon-name:` | inline `now-icon` (any glyph, e.g. `:clock-outline:`) |

Example (the reference design):

```
line1 = ":clock-outline: <b>As of:</b> <size=12>January 9, 2026 at 3:03 PM</size>"
line2 = "The system has identified potential duplicates. <i>Review</i> and decline."
```

Rows are spaced ~12px apart with comfortable line-height, so multi-line banners stay
readable. Icon names / sizes are validated, so these tokens can't inject markup.

**Icons are tinted to the banner type** — both the leading status icon and any
inline icons turn blue / amber / red / green for info / warning / error / success, so
they read as part of the message instead of stark black. (Implemented with a
shadow-scoped `<style>` injected into the alert content, since `now-alert` renders its
icon dark on this stack and exposes no token for it.)

### Events

| Event | When |
| --- | --- |
| `BANNER_DISMISSED` | User clicks the (X) dismiss button. |
| `BANNER_LINK_CLICKED` | User clicks the inline link. |

## Examples (matching the reference designs)

```html
<!-- Warning -->
<x-gegis-library-banner type="warning" title="5 Potential duplicates found"
  line1="The system has identified the following submissions as potential duplicates…"
  line2="Review and determine whether to proceed or decline."></x-gegis-library-banner>

<!-- Info with a link -->
<x-gegis-library-banner type="info" title="Submission Details"
  line1="IronClad Inc." line2="Alt North Avenue, Suite 200, New York, NY 10001"
  link-label="Select the record below that best matches this submission information."
  link-href="#"></x-gegis-library-banner>

<!-- Error -->
<x-gegis-library-banner type="error" title="On Hold — Sanction Review"
  line1="1 entity requires compliance review. Workflow cannot proceed until all matches are resolved."
  line2="Sanctions review pending for 3+ days. Please prioritize resolution to meet SLA requirements."></x-gegis-library-banner>
```

## Live playground

`npm run develop` opens an auto-generated control panel (from `now-ui.json`) so you
can switch type, edit lines, toggle dismiss, etc. in real time.

```bash
cd components/banner
npm install
npm run develop          # or: npm run develop:au   (Australia profile)
```

> `snc develop` previews against the public-npm (Rome-era) `now-alert`; validate the
> final Horizon look on your instance.
