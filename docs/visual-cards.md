# AI Response Visual Cards (`pi-ui`)

Initial comparison baseline: `main` at `fcd94bf`. All `pi-ui` behavior below was added relative to that baseline.

This document is the compatibility record for Pi Web's host-specific AI response format. It describes only shipped behavior in the current tree. All seventeen card types below, including static charts, are implemented; model-defined host actions remain outside this contract.

## Purpose

Pi Web can render selected assistant-authored Markdown code fences as trusted, declarative React cards. Markdown remains the transport and persistence format. No session schema, SSE event, or SDK message type is changed.

The format is designed so that another renderer can choose one of three compatibility levels:

1. **Transport compatible**: preserve the Markdown and show the `pi-ui` fence as source.
2. **Fallback compatible**: validate recognized cards and convert them to deterministic readable Markdown.
3. **Fully compatible**: implement the parsing, streaming states, card views, source access, copy behavior, and export behavior documented below.

## Wire Format

A card is one top-level fenced code block in an assistant text block:

````markdown
```pi-ui
{"version":1,"id":"release-metrics","type":"metrics","title":"Release status","items":[{"label":"Tests","value":"128 passed"}],"fallback":"Release status: 128 tests passed."}
```
````

The fence body is exactly one JSON object. There is no separate MIME type or session entry. The original Markdown is retained verbatim in session JSONL and over the streaming message channel.

### Fence recognition

The current recognizer has the following behavior:

- The canonical info string is exactly `pi-ui`; the model prompt requires this spelling.
- Recognition is case-insensitive, but emitters should always use lowercase `pi-ui`.
- Backtick and tilde fences are accepted.
- The opening fence must contain at least three identical markers.
- The closing fence must use the same marker and at least the opening marker count.
- Up to three leading spaces and trailing spaces or tabs are accepted.
- Fence metadata such as `pi-ui demo` is not accepted.
- Only a top-level Markdown code block is eligible. A fence nested in a list, quote, or longer example fence stays source.
- At most 12 visual cards are recognized in one assistant text block. Later `pi-ui` blocks receive a local limit error.

A CommonMark parser treats an unclosed fence at end of input as a code block. A compatible streaming renderer must therefore inspect the original source offsets and closing marker instead of relying only on the parsed AST.

## Rendering Scope

Visual cards are opt-in at the Markdown renderer boundary.

- Assistant text blocks pass `allowVisualCards=true` and may render cards.
- User messages do not enable visual cards.
- Other uses of `MarkdownBody` keep the default `allowVisualCards=false`.
- Nested examples remain code even in assistant messages.
- Historical assistant messages use the same path, so persisted cards render after reload without migration.

This scope is a trust boundary. A renderer must not enable cards globally merely because it encounters a `pi-ui` fence.

## Protocol Limits

The authoritative schemas live in `lib/visual/schema.ts` and use strict Zod objects.

| Limit | Value |
| --- | ---: |
| Protocol version | `1` |
| Source size | 24 KiB measured as UTF-8 bytes |
| JSON nesting depth | 8 object/array levels |
| Cards per assistant text block | 12 |
| Card ID length | 1-64 characters |
| Card ID pattern | `^[A-Za-z][A-Za-z0-9_-]{0,63}$` |
| Title length | 1-120 visible characters |
| Fallback length | 1-500 visible characters |

All object levels are strict. Unknown fields fail validation. Required text must contain non-whitespace content. All card-provided strings are plain text and are never parsed again as Markdown or HTML.

Every card has these common fields:

| Field | Type | Meaning |
| --- | --- | --- |
| `version` | literal `1` | Protocol version |
| `id` | constrained string | Stable identity within the message |
| `type` | supported type literal | Renderer selection key |
| `title` | string | Visible card heading |
| `fallback` | string | Concise standalone description for unsupported or invalid rendering paths |

The currently supported type list is `metrics`, `comparison`, `steps`, `tabs`, `accordion`, `data-table`, `bar-chart`, `line-chart`, `area-chart`, `donut-chart`, `sparkline`, `heatmap`, `status`, `key-value`, `progress`, `checklist`, and `callout` (17 types). An unknown type, unknown version, or unknown field fails closed as `invalid_schema`.

## `metrics`

Use `metrics` for a compact set of measured values or key facts.

```ts
{
  version: 1;
  id: string;
  type: "metrics";
  title: string;                    // 1-120
  items: Array<{                    // 1-6
    label: string;                  // 1-80
    value: string;                  // 1-64
    detail?: string;                // 1-160
    trend?: {
      direction: "up" | "down" | "flat";
      label: string;                // 1-48
    };
  }>;
  fallback: string;                 // 1-500
}
```

Rendering semantics:

- The view uses a semantic description list.
- Values use tabular numerals and stronger visual weight.
- Detail and trend are secondary text.
- Direction is represented by both a mark and text, not color alone.
- Desktop normally uses one column per item; six items use a 3 by 2 grid.
- At 640 px and below, metrics use two columns.
- Below 380 px, metrics use one column.

Readable Markdown conversion produces a `Metric | Value | Detail` table. Detail and trend label are joined with `; `.

## `comparison`

Use `comparison` to compare two to four choices side by side.

```ts
{
  version: 1;
  id: string;
  type: "comparison";
  title: string;                    // 1-120
  items: Array<{                    // 2-4
    title: string;                  // 1-80
    badge?: string;                 // 1-32
    summary?: string;               // 1-200
    points: string[];               // 1-8, each 1-200
  }>;
  fallback: string;                 // 1-500
}
```

Rendering semantics:

- Each choice is a section with its own heading.
- `badge` is a compact label, not an executable action.
- `summary` is plain secondary text.
- `points` render as a standard list.
- Desktop uses two to four equal columns according to item count.
- At 640 px and below, choices stack vertically.

Readable Markdown conversion produces one level-four heading per choice, appends the badge in parentheses, then emits the summary and bullet points.

## `steps`

Use `steps` for an ordered process, plan, or progress sequence.

```ts
{
  version: 1;
  id: string;
  type: "steps";
  title: string;                    // 1-120
  items: Array<{                    // 1-8
    title: string;                  // 1-100
    description?: string;           // 1-400
    status?: "complete" | "current" | "pending";
  }>;
  fallback: string;                 // 1-500
}
```

Rendering semantics:

- The view uses an ordered list with visible numeric markers.
- A missing status is rendered as `pending` for styling, but remains absent in the stored object.
- Status labels are localized by the host.
- Complete and current steps use distinct marker treatments.
- Long descriptions wrap without crossing the status label or card boundary.

Readable Markdown conversion produces a numbered list. Explicit statuses are included in square brackets and descriptions follow a colon.

## Shared Content Blocks

`tabs` and `accordion` use the same bounded, non-recursive content-block union. Blocks cannot contain cards, controls, Markdown, HTML, links, images, URLs, or actions.

```ts
type VisualContentBlock =
  | { type: "text"; text: string }                                      // 1-1000
  | { type: "list"; style?: "bullet" | "numbered"; items: string[] }  // 1-12, each 1-300
  | { type: "key-value"; items: Array<{ label: string; value: string }> }
  | { type: "code"; language?: string; code: string }                   // code 1-4000
  | { type: "table"; columns: string[]; rows: string[][] };
```

Additional limits:

- `key-value` accepts 1-12 entries; labels are 1-80 characters and values are 1-300.
- `code.language`, when present, is 1-24 ASCII letters, digits, `_`, `+`, or `-`.
- A static content table accepts 1-6 columns and 1-20 rows.
- Static table cells are at most 240 characters.
- Every static row length must exactly match its column count.
- Content blocks render as trusted native elements with plain-text children. They are never passed back through the Markdown renderer.

Readable fallback converts text and lists directly, key-value blocks to two-column Markdown tables, code to a collision-safe fenced block, and static tables to Markdown tables.

## `tabs`

Use `tabs` for parallel views of related information such as platforms, environments, or alternative detail views.

```ts
{
  version: 1;
  id: string;
  type: "tabs";
  title: string;
  items: Array<{                    // 2-6
    id: string;                     // unique, 1-48, same identifier pattern
    label: string;                  // 1-48
    badge?: string;                 // 1-32
    blocks: VisualContentBlock[];   // 1-8
  }>;
  fallback: string;
}
```

Interaction and accessibility:

- The first tab is initially active.
- The tab strip uses `tablist`, `tab`, and `tabpanel` roles with linked IDs.
- Only the active tab is in the tab sequence; inactive panels use native `hidden`.
- Left and Right wrap between tabs. Home and End select the first and last tab.
- Keyboard movement activates and focuses the destination tab.
- The tab strip scrolls horizontally on narrow screens while the panel remains full width.
- Source view hides rather than unmounts a valid card, so the selected tab survives source/card toggling while the message remains mounted.
- No tab switch changes session Markdown, sends a request, or invokes the agent.

Readable copy and export emit every panel in source order as level-four sections, independent of the active tab.

## `accordion`

Use `accordion` for optional detail, diagnostics, or grouped findings.

```ts
{
  version: 1;
  id: string;
  type: "accordion";
  title: string;
  items: Array<{                    // 1-10
    id: string;                     // unique, 1-48
    title: string;                  // 1-100
    summary?: string;               // 1-200
    status?: "neutral" | "success" | "warning" | "error";
    blocks: VisualContentBlock[];   // 1-8
  }>;
  fallback: string;
}
```

Interaction and accessibility:

- The first error item is initially open; otherwise the first item is open.
- Multiple panels may be open simultaneously.
- Header controls expose `aria-expanded` and `aria-controls`; panels use labelled region semantics.
- Up and Down wrap focus between visible headers. Home and End focus the first and last visible header.
- Four or more items receive local text search. Search matches title, summary, and all plain-text block content.
- Matching search results are shown expanded while filtering; accordion collapse is temporarily disabled until the query is cleared.
- Expand-all and collapse-all operate on visible items when no search query is active.
- Optional statuses receive localized text and semantic styling; color is not the only status signal.

Readable copy and export emit every item, status, summary, and block in source order, regardless of current expansion or search state.

## `data-table`

Use `data-table` for genuinely tabular records that benefit from local search, typed sorting, status filtering, pagination, copy, or CSV export.

```ts
{
  version: 1;
  id: string;
  type: "data-table";
  title: string;
  columns: Array<{                 // 1-8, unique ids
    id: string;                    // 1-32
    label: string;                 // 1-80
    dataType: "text" | "number" | "date" | "status" | "code";
    align?: "start" | "center" | "end";
  }>;
  rows: Array<Record<string, string | number | null>>; // 1-100
  fallback: string;
}
```

Cross-field validation is strict:

- Every row must contain every declared column exactly once and may not contain undeclared keys.
- `number` cells are finite JSON numbers.
- `date` cells are ISO `YYYY-MM-DD` values or ISO date-times with a timezone.
- `status` cells are `neutral`, `success`, `warning`, or `error`.
- `text` and `code` cells are strings; all cell strings are at most 500 characters.
- `null` is allowed for every column type and renders as an empty/missing value.

Processing order is global search, status filters, one stable sort, then pagination:

- Search is case-insensitive and matches the textual value of every cell.
- Each status column receives a local enum filter populated from its values.
- Sort activation cycles unsorted, ascending, and descending.
- Numbers sort numerically, dates chronologically, and other types use locale-aware natural text order.
- Equal values preserve source order. Null values remain last in both sort directions.
- The fixed page size is 20 rows. Search, filtering, and sorting return to page one.
- Table headers remain visible when there are no matching rows.
- The table remains semantic on mobile and scrolls only inside its bounded table viewport.

Copy and export behavior:

- Copy produces tab-separated headers and all currently filtered/sorted rows, not only the visible page.
- CSV export uses the same filtered/sorted rows, UTF-8 BOM, CRLF records, and `<card-id>.csv`.
- Clipboard tabs/newlines are flattened where necessary; CSV quotes commas, quotes, and line breaks.
- String cells whose first non-whitespace character is `=`, `+`, `-`, or `@` are prefixed with `'` before clipboard or CSV output to prevent spreadsheet formula execution.
- Search, sorting, filters, pagination, copy, and download are browser-local. They never mutate the stored card or call the agent.
- Readable message copy and session HTML export ignore UI state and emit every source row as a Markdown table.

## Static Chart Cards

`bar-chart`, `line-chart`, `area-chart`, `donut-chart`, `sparkline`, and `heatmap` render static, browser-local numeric visualizations.

Recharts is the trusted renderer implementation behind the cartesian, donut, and sparkline views. It is an implementation detail, not part of the `pi-ui` protocol. The wire format contains only serializable labels, finite numbers, and fixed enums, so another renderer may use any charting library or plain SVG and remain compatible.

Shared chart rules:

- Every numeric value is a finite JSON number; `null` represents a missing point or cell and is preserved.
- The model never supplies colors, palettes, dimensions, styles, number formats, axis ranges, tooltips, legends, or other chart options.
- The host assigns the fixed categorical palette by series index and formats numbers deterministically; the palette is defined once in `components/visual/cards/chart-utils.tsx` and exposed as `--visual-chart-1` through `--visual-chart-8`.
- Charts do not fetch data, poll, subscribe, or expose zoom, pan, drill-down, or any model-defined interactivity.
- Tooltips and legends are purely local display affordances; they do not change the stored card or call the agent.
- Every chart and matrix renders an equivalent visually-hidden data table containing all source values, and charts render without entry animation.

Readable copy and session export convert chart cards to a deterministic Markdown table of their source values rather than the concise `fallback`.

### `bar-chart`, `line-chart`, `area-chart`

Use `bar-chart` for categorical comparison, `line-chart` for an ordered trend, and `area-chart` for cumulative magnitude.

```ts
{
  version: 1;
  id: string;
  type: "bar-chart" | "line-chart" | "area-chart";
  title: string;                    // 1-120
  labels: string[];                 // 2-24, each 1-48
  series: Array<{                   // 1-4, unique ids
    id: string;                     // ^[A-Za-z][A-Za-z0-9_-]{0,31}$, unique
    label: string;                  // 1-48
    values: Array<number | null>;   // exactly one entry per label
  }>;
  xLabel?: string;                  // 1-48
  yLabel?: string;                  // 1-48
  unit?: string;                    // 1-24
  showLegend?: boolean;             // defaults to true when there are 2+ series
  stacked?: boolean;                // bar-chart and area-chart only
  fallback: string;                 // 1-500
}
```

Validation:

- Every `series[].values` array must contain exactly one entry per `labels` entry. A mismatch fails as `invalid_schema`.
- Series ids must be unique. `line-chart` rejects `stacked`; `bar-chart` and `area-chart` accept it.

Rendering and accessibility:

- The canvas is exposed as a labelled `img` role and paired with a visually-hidden table of the source values.
- Series share the fixed categorical palette by index. Stacks render only for `bar-chart` or `area-chart` when `stacked: true`.
- `null` breaks a line and leaves a blank table cell rather than plotting zero.
- At 640 px and below, the cartesian canvas keeps a 520 px minimum width and scrolls horizontally inside its own figure; the page and card do not overflow.

### `donut-chart`

Use `donut-chart` for a part-to-whole split of a few slices.

```ts
{
  version: 1;
  id: string;
  type: "donut-chart";
  title: string;
  items: Array<{                    // 2-8
    label: string;                  // 1-48
    value: number;                  // finite, >= 0
  }>;
  centerLabel?: string;             // 1-48
  centerValue?: string;             // 1-64
  unit?: string;                    // 1-24
  fallback: string;
}
```

Validation and rendering:

- Values are finite and non-negative, and at least one value must be positive.
- Slices use the fixed palette by index and `centerValue`/`centerLabel` render as plain text in the ring centre.
- The donut is a labelled `img` role with a visually-hidden table of every slice.

### `sparkline`

Use `sparkline` for a compact single-series trend beside a headline value.

```ts
{
  version: 1;
  id: string;
  type: "sparkline";
  title: string;
  data: number[];                   // 2-48 finite numbers
  value?: string;                   // 1-64
  detail?: string;                  // 1-160
  trend?: { direction: "up" | "down" | "flat"; label: string };  // label 1-48
  fallback: string;
}
```

Rendering and accessibility:

- The line has no axes; `value`, `detail`, and `trend` carry the headline.
- `trend` uses a directional mark and text, never color alone.
- The layout is two columns on desktop and stacks the summary above the line at 640 px and below.
- A visually-hidden table lists every point.

### `heatmap`

Use `heatmap` for a dense matrix of values across labelled rows and columns.

```ts
{
  version: 1;
  id: string;
  type: "heatmap";
  title: string;
  columns: string[];                // 1-16 unique labels, each 1-32
  rows: Array<{                     // 1-12
    label: string;                  // 1-48
    values: Array<number | null>;   // exactly one entry per column
  }>;
  lowLabel?: string;                // 1-32
  highLabel?: string;               // 1-32
  unit?: string;                    // 1-24
  fallback: string;
}
```

Validation and rendering:

- Every `rows[].values` array must match the `columns` length and at least one value must be numeric; either violation fails as `invalid_schema`.
- Cell intensity is derived from the numeric range in five fixed buckets while the numeric text stays visible.
- The intensity grid is decorative and paired with a visually-hidden labelled table.
- The grid scrolls horizontally inside its own wrapper on narrow screens. `lowLabel`/`highLabel` render a fixed scale legend.

## `status`

Use `status` for a single current condition with a semantic tone.

```ts
{
  version: 1;
  id: string;
  type: "status";
  title: string;
  status: "neutral" | "info" | "success" | "warning" | "error";
  label: string;                    // 1-80
  description?: string;             // 1-500
  detail?: string;                  // 1-160
  fallback: string;
}
```

Rendering:

- The tone is shown by a marker, a localized tone label, and semantic styling; color is not the only signal.
- `label` is the primary line; `description` and `detail` are secondary text.
- Readable conversion emits a `Field | Value` table of status, label, description, and detail.

## `key-value`

Use `key-value` for a flat list of labelled values such as configuration or facts.

```ts
{
  version: 1;
  id: string;
  type: "key-value";
  title: string;
  items: Array<{                    // 1-16
    label: string;                  // 1-80
    value: string;                  // 1-300
    description?: string;           // 1-200
    style?: "text" | "code";        // defaults to text
  }>;
  fallback: string;
}
```

Rendering:

- The view uses a `dl`/`dt`/`dd` description list.
- `style: "code"` renders the value in a `<code>` element; nothing is highlighted or executed.
- Two columns on desktop and a single column at 640 px and below, with internal dividers only.
- Readable conversion emits a `Key | Value | Notes` table where Notes joins the description and the literal `code` marker.

## `progress`

Use `progress` for completion meters of known work.

```ts
{
  version: 1;
  id: string;
  type: "progress";
  title: string;
  items: Array<{                    // 1-8
    label: string;                  // 1-80
    value: number;                  // 0-100
    detail?: string;                // 1-160
    status?: "neutral" | "success" | "warning" | "error";
  }>;
  fallback: string;
}
```

Rendering and accessibility:

- Each item uses a native `<progress>` element with `value` and `max=100`, labelled by its item label.
- The numeric percentage is always shown as text, so the meter is never the only representation.
- `status` defaults to `neutral`; a supplied status adds a localized tone label.
- Readable conversion emits an `Item | Progress | Status | Detail` table with `value%`.

## `checklist`

Use `checklist` for a short list of tasks with completion state.

```ts
{
  version: 1;
  id: string;
  type: "checklist";
  title: string;
  items: Array<{                    // 1-20
    label: string;                  // 1-120
    description?: string;           // 1-300
    status: "complete" | "current" | "pending";
  }>;
  fallback: string;
}
```

Rendering:

- The view is an unordered list; each item combines a status marker, a localized status label, and the label text.
- Markers use distinct glyphs and text in addition to color.
- Readable conversion emits a numbered list with the status in square brackets.

## `callout`

Use `callout` for a short emphasized note with an optional list of points.

```ts
{
  version: 1;
  id: string;
  type: "callout";
  title: string;
  tone: "neutral" | "info" | "success" | "warning" | "error";
  text: string;                     // 1-1000
  points?: string[];                // 1-8, each 1-300
  fallback: string;
}
```

Rendering:

- The note is exposed with `role="note"` and a localized tone label; a marker glyph plus text carries the tone.
- `text` preserves line breaks and `points` render as a bullet list.
- Readable conversion emits a `Tone` line followed by the text and bullets.

## Parse and Render State Machine

A compatible renderer should use these states:

| Input state | Streaming message | Settled message |
| --- | --- | --- |
| Closed, valid card | Render card | Render card |
| Unclosed fence | Show bounded loading placeholder | Show incomplete-card error |
| Closed, invalid JSON | Show local error when parsed | Show local error |
| Closed, invalid schema | Show local error when parsed | Show local error |
| Source over 24 KiB | Show local size error | Show local size error |
| JSON depth over 8 | Show local depth error | Show local depth error |
| More than 12 cards | Show local count error | Show local count error |
| React renderer throws | Replace only that card body with render error | Same |

Errors are local to the card. They must not replace the surrounding Markdown message or crash the message list.

For invalid but bounded JSON objects, the host may display the raw `fallback` field when it is a non-empty string no longer than 500 characters. This is diagnostic recovery only and does not make the object schema-valid.

Every card and every local error provides a source toggle. The source view reuses the normal code block component and can return to the card view. Toggle activation moves keyboard focus to the reciprocal visible control; valid cards remain mounted while source is shown so local tab, accordion, and table state survives the round trip.

## Streaming Behavior

The message source is reparsed as assistant text arrives.

- A recognized unclosed `pi-ui` fence displays a fixed-size skeleton with `aria-busy=true`.
- Incomplete JSON is not repeatedly surfaced as an error during streaming.
- Once the closing fence arrives, normal bounded parsing and schema validation run.
- If generation ends before closure, the placeholder becomes an explicit incomplete-card error with source access.
- Reduced-motion users do not receive the loading pulse animation.

The AST plugin only annotates eligible code nodes with `complete`, `incomplete`, or `limit-exceeded`; parsing and rendering remain in the React card boundary.

## Model Capability Prompt

Pi Web advertises the protocol to models through a bounded system-prompt suffix generated from `lib/visual/catalog.ts`. The global Pi UI settings select which catalog entries participate in that suffix.

The prompt includes:

- The exact `pi-ui` fence requirement.
- The supported card descriptions and validated examples for every currently enabled type.
- Field, content-block, row, and item-count limits.
- A requirement to keep surrounding explanation in Markdown.
- A requirement for an accurate standalone fallback.
- A prohibition on model-defined HTML, JavaScript, event handlers, URLs, styles, colors, icons, and executable actions.
- A statement that table, disclosure, and static chart controls are browser-local display behavior, plus chart/matrix alignment rules, fixed enums, and a prohibition on model-supplied colors, styles, formats, or chart options.
- A warning not to invent metrics or use cards when ordinary prose is clearer.
- Guidance for showing protocol source examples without triggering rendering.

The marker `<pi-web-visual-cards version="1">` makes prompt insertion idempotent. Rules that apply only to tabs/accordion, data tables, charts, or individual enums are omitted when none of their associated types are enabled, so a disabled component is not advertised indirectly by unrelated guidance.

### Capability settings

Pi Web exposes a global Pi UI page in Settings. The page has a master switch and one switch for each of the seventeen component types, grouped into core presentation, interactive content, charts, and status/information. The detail pane shows the exact protocol type, field limits, the catalog example rendered by the trusted renderer, and its JSON source.

Settings are stored outside the repository at `~/.pi/agent/pi-ui/settings.json` and served through `GET`/`PUT /api/pi-ui/settings`. Passing `?sessionId=<id>` adds a server-computed `reloadRequired` boolean to either response; it is not part of the persisted settings document. The file has `version: 1`, an `enabled` boolean, and a complete `components` map keyed by current `VisualCardType` literals. A missing file, missing value, or non-boolean individual value defaults to enabled for backward compatibility. Writes are atomic, preserve unknown top-level fields, and reject unknown component IDs or non-boolean updates. If the settings file itself is malformed, model capability injection fails closed while historical rendering remains available. Each successful API update also advances a process-wide settings generation; main-session startup records a pending generation before asynchronous resource loading, and live main and subagent wrappers record the generation used for startup or reload.

The master and per-component switches control model prompting only:

- When the master switch is off, or every component switch is off, no Pi UI capability suffix is injected.
- Otherwise, only types enabled by both the master switch and their individual switch are listed, with only their applicable shared rules.
- Existing and newly received valid `pi-ui` fences continue to render regardless of these settings. Readable copy and HTML export are also unchanged.
- A settings change requires reloading any already-running session whose applied settings generation is older than the global generation. The settings API reports this per session and also treats an older generation captured by a session still starting as stale, so the warning survives startup races, closing, refreshing, switching sessions, or changing settings from another device. A fresh draft that has already created a runtime through System, Tools, or another non-prompt command publishes that runtime ID to Settings without promoting the draft into session history. Exact-prompt sessions snapshot their configured visual-card suffix instead of rereading settings on each turn. Every successful RPC or extension-command reload refreshes that snapshot and updates the wrapper's applied generation; a settings update racing with reload leaves that wrapper stale and preserves the warning. New or naturally reconstructed sessions start at the current generation.

These settings are a Pi Web host capability preference, not part of the `pi-ui` wire format. They are not persisted in session JSONL and do not alter protocol version 1.

Prompt coverage includes:

- Normal main-agent sessions through `appendSystemPromptOverride`.
- Main-agent Chat-only exact prompts.
- Subagents with resource-derived prompts.
- Subagent Chat-only and other exact-prompt paths.
- Restored wrappers where the SDK rebuilds the prompt before a model call.

Chat only still disables extensions, skills, prompt templates, themes, and the Pi base prompt. The visual-card suffix advertises a host display capability; it does not load resources or expose tools.

Other renderers should advertise only the card types they actually support. The persisted protocol version alone does not imply that every host supports every type.

## Copy Behavior

Completed assistant messages retain two possible copy paths:

- **Raw copy** returns the original assistant Markdown, including valid and invalid `pi-ui` source.
- **Readable copy** appears only when at least one valid top-level card can be converted. It replaces valid cards with deterministic Markdown.

Invalid, nested, incomplete, oversized, and unsupported blocks are preserved as source in readable copy. Readable conversion is disabled while the message is streaming.

The deterministic conversion uses card fields rather than the concise `fallback`, so copied output retains the useful details of the card.

## Session Export

The existing Pi HTML exporter does not understand `pi-ui`. The export route therefore performs a temporary compatibility transform:

1. Read the original session JSONL.
2. Transform only assistant message text content.
3. Replace only valid, complete, top-level cards with deterministic Markdown.
4. Preserve user messages, images, tool content, malformed lines, invalid cards, and incomplete cards.
5. Write a temporary JSONL file only when a change was made.
6. Run the existing exporter on that temporary file.
7. Delete the temporary input and generated output after the response.

The original session file is never rewritten. Both current array-based assistant content and legacy string content are supported. Original CRLF or LF line endings are retained.

A renderer that exports directly can instead render the validated cards, but it must preserve equivalent readable fallback content when its export target cannot carry the visual component.

## Security Boundary

The implementation is deliberately not a general UI runtime.

- JSON is parsed only after source-size and nesting-depth checks.
- Strict schemas reject unknown fields at every object level.
- Card fields render only as React text children.
- Card strings are not reparsed as Markdown or HTML.
- No model-defined script, URL, image, style, class name, icon path, event handler, form, navigation, or action is accepted.
- Tabs, disclosure buttons, search, selects, sort buttons, pagination, clipboard, and CSV download are fixed host controls. Card JSON cannot change their implementation or bind behavior.
- Charts and matrices render only serializable data through a fixed trusted palette and deterministic formatting. Card JSON cannot supply colors, styles, formatters, axis ranges, tooltips, legends, or chart options.
- Existing global HTML sanitization is not relaxed.
- There is no arbitrary component lookup or dynamic code execution.
- Only an exhaustive trusted renderer registry maps validated type literals to React components.
- A React error boundary contains component failures locally.
- Raw source always remains available to the user.

A future control that performs host actions requires a separate threat model and must not be added as an incidental field to this protocol.

## Accessibility and Localization

- Card titles are exposed as section labels.
- Metrics use `dl`, `dt`, and `dd` semantics.
- Comparisons use nested sections, headings, and lists.
- Steps use an ordered list and textual localized statuses.
- Tabs implement roving focus and linked tab/panel semantics.
- Accordions use native buttons, expansion state, labelled regions, and optional textual statuses.
- Data tables retain semantic headers, `aria-sort`, labelled filters, keyboard-operable pagination, and a polite clipboard failure announcement.
- Cartesian, donut, and sparkline charts expose a labelled `img` role and a visually-hidden table of all source values.
- Heatmaps pair a decorative intensity grid with a visually-hidden labelled table.
- Progress uses the native `progress` element labelled by its item label.
- Status, progress, checklist, and callout cards combine a marker, text, and a localized tone or status label; none rely on color alone.
- Loading cards expose busy state and reduced-motion behavior.
- Error text uses a local status region.
- Source and card toggles are keyboard-focusable buttons.
- English, Simplified Chinese, and Traditional Chinese messages cover source controls, errors, loading state, readable copy, step/accordion/table statuses, chart category/value/point headers, the shared status/tone labels reused by status, progress, checklist, and callout cards, search, filters, copy, CSV, pagination, and the global/per-component Pi UI settings page.

Protocol content itself is authored by the model in the conversation language. Enum values and field names remain English protocol literals.

## Source Layout

| Area | Files |
| --- | --- |
| Schemas and limits | `lib/visual/schema.ts` |
| Bounded JSON parsing | `lib/visual/parse.ts` |
| Catalog and prompt examples | `lib/visual/catalog.ts`, `lib/visual/prompt.ts` |
| Capability settings and prompt filtering | `lib/pi-ui-settings.ts`, `lib/pi-ui-prompt.ts`, `lib/pi-ui-session-state.ts`, `app/api/pi-ui/settings/route.ts`, `components/PiUiConfig.tsx` |
| Fence completeness | `lib/visual/fence.ts` |
| HAST annotation | `lib/visual/markdown.ts` |
| Markdown conversion | `lib/visual/fallback.ts`, `lib/visual/markdown-source.ts` |
| Content search and table derivation/export | `lib/visual/content.ts`, `lib/visual/data-table.ts` |
| Session export conversion | `lib/visual/session-export.ts` |
| React boundary and registry | `components/visual/VisualBlock.tsx`, `components/visual/CardRenderer.tsx` |
| Card views | `components/visual/cards/` |
| Trusted chart rendering | `components/visual/cards/chart-utils.tsx`, `CartesianChartCard.tsx`, `ChartCards.tsx` |
| Message integration | `components/MarkdownBody.tsx`, `components/MessageView.tsx` |
| Prompt integration | `lib/rpc-manager.ts`, `lib/subagent-runtime.ts` |
| HTML export integration | `app/api/sessions/[id]/export/route.ts` |
| Styling | `app/globals.css` |
| Localization | `lib/i18n/messages/en.ts`, `zh-CN.ts`, `zh-TW.ts` |

New production dependencies are `zod` for strict runtime validation, `mdast-util-from-markdown` for source-position-aware fallback conversion, and `recharts` as the trusted renderer behind the chart cards. Recharts is an implementation detail of this host, not part of the `pi-ui` protocol.

## Test Coverage

The local change adds coverage for:

- Catalog examples satisfying the runtime schema.
- Unknown fields, invalid IDs, duplicate tab/accordion/data-table IDs, duplicate heatmap columns, row key mismatches, cell type mismatches, calendar-invalid dates, malformed nested tables, mismatched chart/heatmap lengths, duplicate series IDs, all-zero donuts, and all-null heatmaps.
- UTF-8 byte limits and JSON depth limits.
- Closed and unclosed fences, CRLF, tilde fences, and longer closing fences.
- Exact info strings and nested examples.
- Deterministic Markdown conversion for all card types, block-level Markdown escaping for plain text, and preservation of invalid source.
- Chart and utility examples satisfying the runtime schema, deterministic Markdown conversion, and Markdown escaping inside chart and heatmap cells.
- Session JSONL export conversion for chart and heatmap cards.
- Data-table search, status filtering, stable typed sorting, null ordering, TSV/CSV serialization, and spreadsheet-formula neutralization.
- Semantic SSR markup for tab, accordion, and data-table controls.
- Rendering enabled only for assistant text.
- Streaming placeholders, settled incomplete errors, invalid schema fallback, and card count limits.
- Raw and readable copy integration.
- Session JSONL conversion, including legacy content and malformed lines.
- Prompt presence, bounds, restrictions, idempotence, master disablement, and per-component filtering.
- Global Pi UI settings defaults, validation, atomic persistence, API request security, unknown-field handling, process-wide generation tracking, categorized settings UI, and session reload wiring.
- Main-agent and subagent configuration-aware prompt wiring.

Browser verification covers desktop, 390 px, and 320 px layouts in light and dark themes; long text; source toggling and focus transfer; both copy modes; exported HTML; keyboard tabs/accordion behavior; table search/filter/sort/pagination; clipboard and CSV download; nonblank Recharts SVG geometry and hover tooltips; complete hidden chart data tables; heatmap matrices; progress/callout semantics; and card-local chart, heatmap, tab, and table scrolling without page overflow.

## Cross-Renderer Conformance Checklist

A renderer claiming full compatibility should verify all of the following:

- Preserve raw Markdown and session content without format migration.
- Enable cards only in trusted assistant text contexts.
- Recognize only exact top-level `pi-ui` fences.
- Distinguish unclosed streaming fences from complete code blocks using source positions.
- Enforce UTF-8 size, JSON depth, card count, strict field, and item-count limits before rendering.
- Reject unknown versions, types, fields, and enum values.
- Render every string as plain text.
- Implement all current card types, their non-recursive content blocks, chart/matrix alignment rules, and local interaction semantics, or advertise a narrower type catalog to its model.
- Render charts and matrices statically with host-chosen colors and formatting, and provide an equivalent visually-hidden source table.
- Keep table copy/CSV output formula-safe and independent from pagination.
- Keep card failures local and provide raw source access.
- Preserve valid content through readable copy and non-visual exports.
- Preserve invalid or unsupported source rather than silently dropping it.
- Keep prompt insertion idempotent across normal, exact, Chat-only, and subagent prompt paths, and advertise only the component types enabled by the host's current capability settings.
- Test streaming, historical replay, mobile layout, themes, localization, keyboard access, and reduced motion.

## Adding or Changing AI Response Features

Any change to a host-specific AI response format must update this document in the same change. This includes:

- A new fence language or protocol version.
- A new card type, field, enum, limit, or renderer behavior.
- Streaming, error, source, copy, export, or persistence behavior.
- Prompt capability text or prompt injection paths.
- Security, sanitization, action, URL, media, or external-resource behavior.
- Compatibility behavior required from another renderer.

For a new `pi-ui` card type, update the schema, catalog example, prompt, exhaustive renderer registry, React component, deterministic Markdown fallback, localization, responsive styles, export behavior, and tests together. Do not document a proposed type as implemented until all of those paths exist.

## Other Local Change Relative to `main`

The working tree also adds `suppressHydrationWarning` directly to the inline theme initialization `<script>` in `app/layout.tsx`. The existing warning on `<html>` and `<body>` does not suppress a mismatch on a nested script node. This prevents a development hydration issue when a browser extension or browser processing changes the inline script before React hydrates, while preserving first-paint theme initialization. This fix is adjacent to, but not part of, the `pi-ui` protocol.
