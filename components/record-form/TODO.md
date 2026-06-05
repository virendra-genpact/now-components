# record-form — field type TODOs

Field types from `sys_glide_object` that need better handling.
Current fallback for all of these: `now-input type="text"` (plain text input).

## Blocked on missing public npm component

| Type(s) | Ideal component | Blocker |
|---|---|---|
| `color` | `now-color-picker` | Public npm: false — use text input now |
| `glide_duration` | dedicated duration picker | No Horizon duration picker available; currently maps to `now-date-time type="time"` (approximate) |

## Needs dedicated Horizon widget (not available)

| Type(s) | Description | What to do when available |
|---|---|---|
| `audio` | Audio attachment | Replace image indicator with audio player |
| `video` | Video attachment | Replace image indicator with video player |
| `geo_point` | Latitude/longitude coordinates | Map picker component |
| `journal_list` | Full activity stream (append-only entries) | Dedicated activity stream renderer |
| `script` / `script_plain` | Server-side Glide script | Code editor (Monaco or similar) |
| `conditions` / `condition_string` | Encoded query builder | Condition builder widget |

## Currently approximated (works, not ideal)

| Type | Current rendering | Ideal |
|---|---|---|
| `glide_duration` | `now-date-time type="time"` | Dedicated duration picker (h:mm:ss) |
| `insert_timestamp` | `now-date-time type="date-time"` readonly | ✓ acceptable |
| `journal` / `journal_input` | `now-textarea` readonly | Activity stream append UI |
| `script` / `script_plain` | `now-textarea` readonly | Code editor with syntax highlight |

## Complete type coverage as of today

| Type | Component |
|---|---|
| `boolean` | `now-toggle` |
| `glide_date`, `due_date` | `now-date-time type="date"` |
| `glide_date_time`, `calendar_date_time`, `insert_timestamp` | `now-date-time type="date-time"` |
| `glide_time`, `glide_utc_time`, `glide_duration` | `now-date-time type="time"` |
| `integer`, `float`, `decimal`, `currency`, `longint`, `price`, `percent_complete` | `now-input type="number"` |
| `email` | `now-input type="email"` |
| `ip_addr` | `now-input type="ip"` |
| `reference`, `domain_id`, `glide_list`, `document_id` | `now-typeahead` + search icon |
| `ph_number`, `phone_number`, `phone_number_e164` | `now-input` + phone icon |
| `password`, `password2` | `now-input` + lock icon (masked) |
| `url`, `glide_uri` | `now-input` + link icon |
| `html`, `translated_html` | `now-rich-text` (read-only) / `now-textarea` (edit) |
| `journal`, `journal_input`, `journal_list`, `wiki_text`, `script`, `script_plain`, `conditions`, `condition_string`, `translated_text`, `data_structure`, `simple_name_values`, `dynamic_attribute_store` | `now-textarea` |
| `user_image`, `file_attachment`, `photo` | image attachment indicator |
| `choice`, `radio`, `sys_class_name`, + any field with choice attribute 1/2/3 | `now-dropdown` |
| Everything else (`string`, `table_name`, `field_name`, `language`, `workflow`, `color`, …) | `now-input type="text"` |
