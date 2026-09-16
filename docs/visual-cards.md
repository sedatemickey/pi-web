# AI Response Visual Cards (`pi-ui`)

Initial comparison baseline: `main` at `fcd94bf`. All `pi-ui` behavior below was added relative to that baseline.

This document is the compatibility record for Pi Web's host-specific AI response format. It describes only behavior that exists in the current working tree. Proposed controls such as tabs, interactive tables, and charts are not part of this contract yet.

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

The currently supported type list is `metrics`, `comparison`, and `steps`. An unknown type, unknown version, or unknown field fails closed as `invalid_schema`.

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

Every card and every local error provides a source toggle. The source view reuses the normal code block component and can return to the card view.

## Streaming Behavior

The message source is reparsed as assistant text arrives.

- A recognized unclosed `pi-ui` fence displays a fixed-size skeleton with `aria-busy=true`.
- Incomplete JSON is not repeatedly surfaced as an error during streaming.
- Once the closing fence arrives, normal bounded parsing and schema validation run.
- If generation ends before closure, the placeholder becomes an explicit incomplete-card error with source access.
- Reduced-motion users do not receive the loading pulse animation.

The AST plugin only annotates eligible code nodes with `complete`, `incomplete`, or `limit-exceeded`; parsing and rendering remain in the React card boundary.

## Model Capability Prompt

Pi Web advertises the protocol to models through a bounded system-prompt suffix generated from `lib/visual/catalog.ts`.

The prompt includes:

- The exact `pi-ui` fence requirement.
- The three supported card descriptions and validated examples.
- Field and item-count limits.
- A requirement to keep surrounding explanation in Markdown.
- A requirement for an accurate standalone fallback.
- A prohibition on HTML, JavaScript, event handlers, URLs, styles, colors, icons, and executable actions.
- A warning not to invent metrics or use cards when ordinary prose is clearer.
- Guidance for showing protocol source examples without triggering rendering.

The marker `<pi-web-visual-cards version="1">` makes prompt insertion idempotent.

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
- No script, URL, image, style, class name, icon path, event handler, form, navigation, or action is accepted.
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
- Loading cards expose busy state and reduced-motion behavior.
- Error text uses a local status region.
- Source and card toggles are keyboard-focusable buttons.
- English, Simplified Chinese, and Traditional Chinese messages cover source controls, errors, loading state, readable copy, and step statuses.

Protocol content itself is authored by the model in the conversation language. Enum values and field names remain English protocol literals.

## Source Layout

| Area | Files |
| --- | --- |
| Schemas and limits | `lib/visual/schema.ts` |
| Bounded JSON parsing | `lib/visual/parse.ts` |
| Catalog and prompt examples | `lib/visual/catalog.ts`, `lib/visual/prompt.ts` |
| Fence completeness | `lib/visual/fence.ts` |
| HAST annotation | `lib/visual/markdown.ts` |
| Markdown conversion | `lib/visual/fallback.ts`, `lib/visual/markdown-source.ts` |
| Session export conversion | `lib/visual/session-export.ts` |
| React boundary and registry | `components/visual/VisualBlock.tsx`, `components/visual/CardRenderer.tsx` |
| Card views | `components/visual/cards/` |
| Message integration | `components/MarkdownBody.tsx`, `components/MessageView.tsx` |
| Prompt integration | `lib/rpc-manager.ts`, `lib/subagent-runtime.ts` |
| HTML export integration | `app/api/sessions/[id]/export/route.ts` |
| Styling | `app/globals.css` |
| Localization | `lib/i18n/messages/en.ts`, `zh-CN.ts`, `zh-TW.ts` |

New production dependencies are `zod` for strict runtime validation and `mdast-util-from-markdown` for source-position-aware fallback conversion.

## Test Coverage

The local change adds coverage for:

- Catalog examples satisfying the runtime schema.
- Unknown fields and invalid IDs.
- UTF-8 byte limits and JSON depth limits.
- Closed and unclosed fences, CRLF, tilde fences, and longer closing fences.
- Exact info strings and nested examples.
- Deterministic Markdown conversion and preservation of invalid source.
- Rendering enabled only for assistant text.
- Streaming placeholders, settled incomplete errors, invalid schema fallback, and card count limits.
- Raw and readable copy integration.
- Session JSONL conversion, including legacy content and malformed lines.
- Prompt presence, bounds, restrictions, and idempotence.
- Main-agent and subagent prompt wiring.

Browser verification additionally covers desktop and 390 px layouts, light and dark themes, long text, source toggling, both copy modes, and exported HTML.

## Cross-Renderer Conformance Checklist

A renderer claiming full compatibility should verify all of the following:

- Preserve raw Markdown and session content without format migration.
- Enable cards only in trusted assistant text contexts.
- Recognize only exact top-level `pi-ui` fences.
- Distinguish unclosed streaming fences from complete code blocks using source positions.
- Enforce UTF-8 size, JSON depth, card count, strict field, and item-count limits before rendering.
- Reject unknown versions, types, fields, and enum values.
- Render every string as plain text.
- Implement all three current card types or advertise a narrower type catalog to its model.
- Keep card failures local and provide raw source access.
- Preserve valid content through readable copy and non-visual exports.
- Preserve invalid or unsupported source rather than silently dropping it.
- Keep prompt insertion idempotent across normal, exact, Chat-only, and subagent prompt paths.
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
