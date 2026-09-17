import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { tsconfigPaths: true });
const { VISUAL_CARD_CATALOG } = await jiti.import("./catalog.ts");
const { transformSessionJsonlVisualCards } = await jiti.import("./session-export.ts");

function visualFence(card, closed = true) {
  return `\`\`\`pi-ui\n${JSON.stringify(card)}${closed ? "\n```" : ""}`;
}

const EXPORT_CARDS = [
  {
    version: 1,
    id: "export-bars",
    type: "bar-chart",
    title: "Export bars",
    labels: ["A", "B"],
    series: [{ id: "count", label: "Count", values: [1, 2] }],
    unit: "items",
    fallback: "Export bars fallback.",
  },
  {
    version: 1,
    id: "export-line",
    type: "line-chart",
    title: "Export line",
    labels: ["A", "B"],
    series: [{ id: "share", label: "Share", values: [2, 4] }],
    fallback: "Export line fallback.",
  },
  {
    version: 1,
    id: "export-area",
    type: "area-chart",
    title: "Export area",
    labels: ["A", "B"],
    series: [{ id: "storage", label: "Storage", values: [3, 6] }],
    fallback: "Export area fallback.",
  },
  {
    version: 1,
    id: "export-donut",
    type: "donut-chart",
    title: "Export donut",
    items: [{ label: "X", value: 70 }, { label: "Y", value: 30 }],
    centerLabel: "Total",
    centerValue: "100",
    fallback: "Export donut fallback.",
  },
  {
    version: 1,
    id: "export-sparkline",
    type: "sparkline",
    title: "Export sparkline",
    data: [1, 2, 3],
    value: "3",
    detail: "Trending up",
    trend: { direction: "up", label: "Rising" },
    fallback: "Export sparkline fallback.",
  },
  {
    version: 1,
    id: "export-heatmap",
    type: "heatmap",
    title: "Export heatmap",
    columns: ["Mon", "Tue"],
    rows: [{ label: "API", values: [4, 8] }],
    lowLabel: "Low",
    highLabel: "High",
    unit: "qps",
    fallback: "Export heatmap fallback.",
  },
  {
    version: 1,
    id: "export-status",
    type: "status",
    title: "Export status",
    status: "error",
    label: "Build failed",
    description: "Type errors remain",
    detail: "Run #7",
    fallback: "Export status fallback.",
  },
  {
    version: 1,
    id: "export-kv",
    type: "key-value",
    title: "Export key values",
    items: [
      { label: "Region", value: "eu-west-1" },
      { label: "Digest", value: "sha256:abc", style: "code", description: "Pinned" },
    ],
    fallback: "Export key values fallback.",
  },
  {
    version: 1,
    id: "export-progress",
    type: "progress",
    title: "Export progress",
    items: [
      { label: "Upload", value: 40, detail: "2 of 5", status: "warning" },
      { label: "Verify", value: 0, status: "neutral" },
    ],
    fallback: "Export progress fallback.",
  },
  {
    version: 1,
    id: "export-checklist",
    type: "checklist",
    title: "Export checklist",
    items: [
      { label: "Review", status: "complete" },
      { label: "Approve", description: "Awaiting sign-off", status: "current" },
      { label: "Publish", status: "pending" },
    ],
    fallback: "Export checklist fallback.",
  },
  {
    version: 1,
    id: "export-callout",
    type: "callout",
    title: "Export callout",
    tone: "info",
    text: "Read the migration guide first.",
    points: ["Keep a backup", "Freeze writes"],
    fallback: "Export callout fallback.",
  },
];

function entry(id, role, text) {
  return {
    type: "message",
    id,
    parentId: null,
    timestamp: "2026-01-01T00:00:00.000Z",
    message: {
      role,
      content: [{ type: "text", text }, { type: "image", data: "unchanged" }],
    },
  };
}

test("converts only assistant text blocks in exported session JSONL", () => {
  const header = { type: "session", version: 3, id: "session", timestamp: "2026-01-01T00:00:00.000Z", cwd: "/tmp" };
  const assistant = entry("assistant", "assistant", `Before\n\n${visualFence(VISUAL_CARD_CATALOG.comparison.example)}\n\nAfter`);
  const user = entry("user", "user", visualFence(VISUAL_CARD_CATALOG.steps.example));
  const source = [header, assistant, user].map((value) => JSON.stringify(value)).join("\n") + "\n";

  const result = transformSessionJsonlVisualCards(source);
  assert.equal(result.changed, true);
  assert.equal(result.content.endsWith("\n"), true);

  const lines = result.content.trimEnd().split("\n").map((line) => JSON.parse(line));
  const assistantText = lines[1].message.content[0].text;
  assert.match(assistantText, /### Storage options/);
  assert.match(assistantText, /#### SQLite \(Recommended\)/);
  assert.doesNotMatch(assistantText, /```pi-ui/);
  assert.equal(lines[1].message.content[1].data, "unchanged");
  assert.equal(lines[2].message.content[0].text, user.message.content[0].text);
});

test("preserves invalid, incomplete, and malformed JSONL content", () => {
  const invalid = entry("invalid", "assistant", "```pi-ui\n{bad json}\n```");
  const incomplete = entry("incomplete", "assistant", visualFence(VISUAL_CARD_CATALOG.metrics.example, false));
  const source = ["not-json", JSON.stringify(invalid), JSON.stringify(incomplete)].join("\r\n") + "\r\n";

  const result = transformSessionJsonlVisualCards(source);
  assert.deepEqual(result, { content: source, changed: false });
});

test("exports every interactive card as complete readable Markdown", () => {
  const cards = [
    VISUAL_CARD_CATALOG.tabs.example,
    VISUAL_CARD_CATALOG.accordion.example,
    VISUAL_CARD_CATALOG["data-table"].example,
  ];
  const message = entry("interactive", "assistant", cards.map((card) => visualFence(card)).join("\n\n"));
  const result = transformSessionJsonlVisualCards(`${JSON.stringify(message)}\n`);
  const text = JSON.parse(result.content).message.content[0].text;

  assert.equal(result.changed, true);
  assert.match(text, /### Platform notes/);
  assert.match(text, /### Release checks/);
  assert.match(text, /### Test results/);
  assert.match(text, /\| Integration \| 42 \| warning \|/);
  assert.doesNotMatch(text, /```pi-ui/);
});

test("supports legacy assistant string content", () => {
  const message = {
    type: "message",
    message: { role: "assistant", content: visualFence(VISUAL_CARD_CATALOG.steps.example) },
  };
  const result = transformSessionJsonlVisualCards(`${JSON.stringify(message)}\n`);

  assert.equal(result.changed, true);
  assert.match(JSON.parse(result.content).message.content, /### Deployment/);
});

test("export converts chart and utility cards without dropping data or pi-ui", () => {
  const message = entry("charts", "assistant", EXPORT_CARDS.map((card) => visualFence(card)).join("\n\n"));
  const result = transformSessionJsonlVisualCards(`${JSON.stringify(message)}\n`);
  const text = JSON.parse(result.content).message.content[0].text;
  const includes = (fragment) => assert.ok(text.includes(fragment), `missing: ${fragment}`);

  assert.equal(result.changed, true);
  assert.doesNotMatch(text, /```pi-ui/);
  assert.ok(!text.includes(JSON.stringify(EXPORT_CARDS[0])));

  // bar-chart
  includes("### Export bars");
  includes("| A | 1 |");
  includes("| B | 2 |");

  // line-chart
  includes("### Export line");
  includes("| A | 2 |");
  includes("| B | 4 |");

  // area-chart
  includes("### Export area");
  includes("| A | 3 |");
  includes("| B | 6 |");

  // donut-chart
  includes("### Export donut");
  includes("| X | 70 |");
  includes("| Y | 30 |");
  includes("Center label: Total · Center value: 100");

  // sparkline
  includes("### Export sparkline");
  includes("| 1 | 1 |");
  includes("| 3 | 3 |");
  includes("Trend: up (Rising)");

  // heatmap
  includes("### Export heatmap");
  includes("|  | Mon | Tue |");
  includes("| API | 4 | 8 |");
  includes("Unit: qps");

  // status
  includes("### Export status");
  includes("| Status | error |");
  includes("| Label | Build failed |");
  includes("| Description | Type errors remain |");
  includes("| Detail | Run #7 |");

  // key-value
  includes("### Export key values");
  includes("| Region | eu-west-1 |  |");
  includes("| Digest | sha256:abc | Pinned; code |");

  // progress
  includes("### Export progress");
  includes("| Upload | 40% | warning | 2 of 5 |");
  includes("| Verify | 0% | neutral |  |");

  // checklist
  includes("### Export checklist");
  includes("1. **Review** [complete]");
  includes("2. **Approve** [current]: Awaiting sign-off");
  includes("3. **Publish** [pending]");

  // callout
  includes("### Export callout");
  includes("**Tone:** info");
  includes("Read the migration guide first.");
  includes("- Keep a backup");
  includes("- Freeze writes");
});
