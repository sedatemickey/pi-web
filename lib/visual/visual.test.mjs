import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { tsconfigPaths: true });
const { VISUAL_CARD_CATALOG } = await jiti.import("./catalog.ts");
const { inspectVisualFence, transformVisualCardsToMarkdown } = await jiti.import("./markdown-source.ts");
const { parseVisualCard } = await jiti.import("./parse.ts");
const {
  MAX_VISUAL_CARD_JSON_DEPTH,
  MAX_VISUAL_CARD_SOURCE_BYTES,
} = await jiti.import("./schema.ts");
const { fromMarkdown } = await import("mdast-util-from-markdown");

function fenced(value, marker = "```") {
  return `${marker}pi-ui\n${JSON.stringify(value, null, 2)}\n${marker}`;
}

function codeNode(markdown) {
  const node = fromMarkdown(markdown).children.find((child) => child.type === "code");
  assert.ok(node);
  return node;
}

const CHART_AND_UTILITY_CARDS = [
  {
    version: 1,
    id: "traffic-bars",
    type: "bar-chart",
    title: "Traffic by month",
    labels: ["Jan", "Feb", "Mar"],
    series: [
      { id: "requests", label: "Requests", values: [120, 150, 180] },
      { id: "errors", label: "Errors", values: [3, null, 7] },
    ],
    xLabel: "Month",
    yLabel: "Count",
    unit: "req",
    stacked: true,
    fallback: "Traffic by month: 120, 150, and 180 requests.",
  },
  {
    version: 1,
    id: "latency-line",
    type: "line-chart",
    title: "p95 latency",
    labels: ["P50", "P95", "P99"],
    series: [{ id: "latency", label: "Milliseconds", values: [12, 45, 90] }],
    xLabel: "Percentile",
    yLabel: "Latency",
    unit: "ms",
    showLegend: false,
    fallback: "p95 latency rises from 12 ms to 90 ms across percentiles.",
  },
  {
    version: 1,
    id: "storage-area",
    type: "area-chart",
    title: "Storage growth",
    labels: ["Q1", "Q2"],
    series: [{ id: "storage", label: "Storage (GB)", values: [10, 20] }],
    unit: "GB",
    stacked: true,
    fallback: "Storage grew from 10 GB to 20 GB.",
  },
  {
    version: 1,
    id: "traffic-donut",
    type: "donut-chart",
    title: "Traffic share",
    items: [
      { label: "Direct", value: 60 },
      { label: "Search", value: 40 },
    ],
    centerLabel: "Total",
    centerValue: "100",
    unit: "%",
    fallback: "Direct accounts for 60% of traffic and search for 40%.",
  },
  {
    version: 1,
    id: "uptime-sparkline",
    type: "sparkline",
    title: "Uptime",
    data: [98, 99, 97, 100],
    value: "99.5%",
    detail: "Last 4 days",
    trend: { direction: "up", label: "Improving" },
    fallback: "Uptime is 99.5% over the last 4 days and improving.",
  },
  {
    version: 1,
    id: "cluster-heatmap",
    type: "heatmap",
    title: "Cluster load",
    columns: ["Mon", "Tue", "Wed"],
    rows: [
      { label: "API", values: [10, 20, null] },
      { label: "DB", values: [5, null, 8] },
    ],
    lowLabel: "Idle",
    highLabel: "Busy",
    unit: "qps",
    fallback: "API load peaks at 20 qps; DB stays below 8 qps.",
  },
  {
    version: 1,
    id: "deploy-status",
    type: "status",
    title: "Deploy status",
    status: "warning",
    label: "Deploy pending",
    description: "Waiting for approval",
    detail: "Run #42",
    fallback: "Deploy pending: waiting for approval for run #42.",
  },
  {
    version: 1,
    id: "runtime-config",
    type: "key-value",
    title: "Runtime config",
    items: [
      { label: "Region", value: "us-east-1" },
      { label: "Image", value: "app:2.1", description: "Signed digest", style: "code" },
    ],
    fallback: "Runtime config: region us-east-1, image app:2.1.",
  },
  {
    version: 1,
    id: "migration-progress",
    type: "progress",
    title: "Migration",
    items: [
      { label: "Tables", value: 75, detail: "3 of 4 migrated", status: "warning" },
      { label: "Indexes", value: 100, status: "success" },
    ],
    fallback: "Migration: tables 75% complete; indexes done.",
  },
  {
    version: 1,
    id: "release-checklist",
    type: "checklist",
    title: "Release checklist",
    items: [
      { label: "Run tests", status: "complete" },
      { label: "Update changelog", description: "Add release notes", status: "current" },
      { label: "Tag release", status: "pending" },
    ],
    fallback: "Release checklist: tests done, changelog in progress, tag pending.",
  },
  {
    version: 1,
    id: "migration-callout",
    type: "callout",
    title: "Before you migrate",
    tone: "warning",
    text: "The migration is irreversible.",
    points: ["Back up the database first", "Schedule a maintenance window"],
    fallback: "Warning: the migration is irreversible; back up first and schedule a window.",
  },
];

test("catalog examples satisfy the runtime schema", () => {
  for (const entry of Object.values(VISUAL_CARD_CATALOG)) {
    assert.deepEqual(parseVisualCard(JSON.stringify(entry.example)), { ok: true, card: entry.example });
  }
});

test("rejects unknown fields and invalid identifiers", () => {
  const example = VISUAL_CARD_CATALOG.metrics.example;
  assert.deepEqual(
    parseVisualCard(JSON.stringify({ ...example, extra: true })),
    { ok: false, code: "invalid_schema" },
  );
  assert.deepEqual(
    parseVisualCard(JSON.stringify({ ...example, id: "not valid" })),
    { ok: false, code: "invalid_schema" },
  );
});

test("rejects duplicate interactive ids and malformed table rows", () => {
  const tabs = structuredClone(VISUAL_CARD_CATALOG.tabs.example);
  tabs.items[1].id = tabs.items[0].id;
  assert.deepEqual(parseVisualCard(JSON.stringify(tabs)), { ok: false, code: "invalid_schema" });

  const table = structuredClone(VISUAL_CARD_CATALOG["data-table"].example);
  table.columns[1].id = table.columns[0].id;
  assert.deepEqual(parseVisualCard(JSON.stringify(table)), { ok: false, code: "invalid_schema" });

  const missingCell = structuredClone(VISUAL_CARD_CATALOG["data-table"].example);
  delete missingCell.rows[0].status;
  assert.deepEqual(parseVisualCard(JSON.stringify(missingCell)), { ok: false, code: "invalid_schema" });

  const wrongType = structuredClone(VISUAL_CARD_CATALOG["data-table"].example);
  wrongType.rows[0].passed = "128";
  assert.deepEqual(parseVisualCard(JSON.stringify(wrongType)), { ok: false, code: "invalid_schema" });

  const unevenNestedTable = structuredClone(VISUAL_CARD_CATALOG.tabs.example);
  unevenNestedTable.items[0].blocks.push({ type: "table", columns: ["A", "B"], rows: [["only one"]] });
  assert.deepEqual(parseVisualCard(JSON.stringify(unevenNestedTable)), { ok: false, code: "invalid_schema" });

  const invalidDate = {
    ...structuredClone(VISUAL_CARD_CATALOG["data-table"].example),
    columns: [{ id: "date", label: "Date", dataType: "date" }],
    rows: [{ date: "2024-02-30" }],
  };
  assert.deepEqual(parseVisualCard(JSON.stringify(invalidDate)), { ok: false, code: "invalid_schema" });
  invalidDate.rows[0].date = "2024-02-29";
  assert.equal(parseVisualCard(JSON.stringify(invalidDate)).ok, true);
  invalidDate.rows[0].date = "2023-02-29";
  assert.deepEqual(parseVisualCard(JSON.stringify(invalidDate)), { ok: false, code: "invalid_schema" });

  const unevenChart = structuredClone(VISUAL_CARD_CATALOG["bar-chart"].example);
  unevenChart.series[0].values.pop();
  assert.deepEqual(parseVisualCard(JSON.stringify(unevenChart)), { ok: false, code: "invalid_schema" });

  const duplicateSeries = structuredClone(VISUAL_CARD_CATALOG["line-chart"].example);
  duplicateSeries.series.push({ ...duplicateSeries.series[0] });
  assert.deepEqual(parseVisualCard(JSON.stringify(duplicateSeries)), { ok: false, code: "invalid_schema" });

  const emptyDonut = structuredClone(VISUAL_CARD_CATALOG["donut-chart"].example);
  emptyDonut.items.forEach((item) => { item.value = 0; });
  assert.deepEqual(parseVisualCard(JSON.stringify(emptyDonut)), { ok: false, code: "invalid_schema" });

  const unevenHeatmap = structuredClone(VISUAL_CARD_CATALOG.heatmap.example);
  unevenHeatmap.rows[0].values.pop();
  assert.deepEqual(parseVisualCard(JSON.stringify(unevenHeatmap)), { ok: false, code: "invalid_schema" });

  const duplicateHeatmapColumns = structuredClone(VISUAL_CARD_CATALOG.heatmap.example);
  duplicateHeatmapColumns.columns[1] = duplicateHeatmapColumns.columns[0];
  assert.deepEqual(parseVisualCard(JSON.stringify(duplicateHeatmapColumns)), { ok: false, code: "invalid_schema" });

  const emptyHeatmap = structuredClone(VISUAL_CARD_CATALOG.heatmap.example);
  emptyHeatmap.rows.forEach((row) => { row.values = row.values.map(() => null); });
  assert.deepEqual(parseVisualCard(JSON.stringify(emptyHeatmap)), { ok: false, code: "invalid_schema" });
});

test("checks source size and nesting depth before schema validation", () => {
  assert.deepEqual(
    parseVisualCard(" ".repeat(MAX_VISUAL_CARD_SOURCE_BYTES + 1)),
    { ok: false, code: "too_large" },
  );
  assert.deepEqual(
    parseVisualCard("汉".repeat(Math.floor(MAX_VISUAL_CARD_SOURCE_BYTES / 3) + 1)),
    { ok: false, code: "too_large" },
  );
  const deeplyNested = `${"[".repeat(MAX_VISUAL_CARD_JSON_DEPTH + 1)}0${"]".repeat(MAX_VISUAL_CARD_JSON_DEPTH + 1)}`;
  assert.deepEqual(parseVisualCard(deeplyNested), { ok: false, code: "too_deep" });

  const bracesInsideString = JSON.stringify({
    ...VISUAL_CARD_CATALOG.steps.example,
    fallback: "[{{{{{{{{{{ literal text }}}}}}}}}}]",
  });
  assert.equal(parseVisualCard(bracesInsideString).ok, true);
});

test("distinguishes closed and unclosed visual fences", () => {
  const closed = "```pi-ui\n{}\n```";
  const open = "```pi-ui\n{}";
  assert.equal(inspectVisualFence(closed, codeNode(closed).position)?.closed, true);
  assert.equal(inspectVisualFence(open, codeNode(open).position)?.closed, false);
});

test("accepts CRLF, tilde fences, and longer closing fences", () => {
  const crlf = "~~~~pi-ui\r\n{}\r\n~~~~~";
  const result = inspectVisualFence(crlf, codeNode(crlf).position);
  assert.deepEqual(result, { marker: "~", size: 4, closed: true });
});

test("requires an exact pi-ui info string", () => {
  const markdown = "```pi-ui demo\n{}\n```";
  assert.equal(inspectVisualFence(markdown, codeNode(markdown).position), null);
});

test("converts valid top-level cards to readable Markdown", () => {
  const source = `Before\n\n${fenced(VISUAL_CARD_CATALOG.metrics.example)}\n\nAfter`;
  const transformed = transformVisualCardsToMarkdown(source);

  assert.match(transformed, /^Before/m);
  assert.match(transformed, /### Release status/);
  assert.match(transformed, /\| Tests \| 128 passed \| Full suite \|/);
  assert.doesNotMatch(transformed, /```pi-ui/);
  assert.match(transformed, /After$/);
});

test("converts every interactive card view to complete readable Markdown", () => {
  const source = [
    VISUAL_CARD_CATALOG.tabs.example,
    VISUAL_CARD_CATALOG.accordion.example,
    VISUAL_CARD_CATALOG["data-table"].example,
  ].map((card) => fenced(card)).join("\n\n");
  const transformed = transformVisualCardsToMarkdown(source);

  assert.match(transformed, /### Platform notes/);
  assert.match(transformed, /#### Linux \(Recommended\)/);
  assert.match(transformed, /#### Windows/);
  assert.match(transformed, /### Release checks/);
  assert.match(transformed, /#### Test suite \[success\]/);
  assert.match(transformed, /\| Property \| Value \|/);
  assert.match(transformed, /### Test results/);
  assert.match(transformed, /\| Suite \| Passed \| Status \|/);
  assert.match(transformed, /\| Integration \| 42 \| warning \|/);
  assert.doesNotMatch(transformed, /```pi-ui/);
});

test("escapes block-level Markdown syntax from plain-text content", () => {
  const tabs = structuredClone(VISUAL_CARD_CATALOG.tabs.example);
  tabs.items[0].blocks = [{
    type: "text",
    text: "# Literal heading\nSetext title\n=\n---\n1. Literal item\n   ~~~ js\ninside\n~~~\n    Indented text",
  }];
  const transformed = transformVisualCardsToMarkdown(fenced(tabs));
  const tree = fromMarkdown(transformed);
  const headings = tree.children.filter((node) => node.type === "heading");

  assert.match(transformed, /\\# Literal heading/);
  assert.match(transformed, /\\=/);
  assert.match(transformed, /\\---/);
  assert.match(transformed, /1\\\. Literal item/);
  assert.match(transformed, /\\~~~ js/);
  assert.match(transformed, /&#32;    Indented text/);
  assert.deepEqual(headings.map((node) => node.depth), [3, 4, 4]);
  assert.equal(tree.children.some((node) => node.type === "code" || node.type === "thematicBreak" || node.type === "list"), false);
});

test("preserves nested, incomplete, and invalid visual blocks", () => {
  const nested = `- Example:\n\n  ${fenced(VISUAL_CARD_CATALOG.steps.example).replaceAll("\n", "\n  ")}`;
  const incomplete = fenced(VISUAL_CARD_CATALOG.steps.example).replace(/\n```$/, "");
  const invalid = "```pi-ui\n{bad json}\n```";

  assert.equal(transformVisualCardsToMarkdown(nested), nested);
  assert.equal(transformVisualCardsToMarkdown(incomplete), incomplete);
  assert.equal(transformVisualCardsToMarkdown(invalid), invalid);
});

test("does not treat a pi-ui example inside a longer outer fence as a card", () => {
  const inner = fenced(VISUAL_CARD_CATALOG.comparison.example);
  const source = `\`\`\`\`markdown\n${inner}\n\`\`\`\``;
  assert.equal(transformVisualCardsToMarkdown(source), source);
});

test("chart and utility card examples satisfy the runtime schema", () => {
  for (const card of CHART_AND_UTILITY_CARDS) {
    assert.equal(parseVisualCard(JSON.stringify(card)).ok, true, card.type);
  }
});

test("converts chart and utility cards to complete readable Markdown", () => {
  const source = CHART_AND_UTILITY_CARDS.map((card) => fenced(card)).join("\n\n");
  const transformed = transformVisualCardsToMarkdown(source);
  const includes = (fragment) => assert.ok(transformed.includes(fragment), `missing: ${fragment}`);

  assert.doesNotMatch(transformed, /```pi-ui/);

  // bar-chart
  includes("### Traffic by month");
  includes("X axis: Month · Y axis: Count · Unit: req · Stacked");
  includes("| Month | Requests | Errors |");
  includes("| Jan | 120 | 3 |");
  includes("| Feb | 150 |  |");
  includes("| Mar | 180 | 7 |");

  // line-chart
  includes("### p95 latency");
  includes("| Percentile | Milliseconds |");
  includes("| P50 | 12 |");
  includes("| P99 | 90 |");

  // area-chart
  includes("### Storage growth");
  includes("Unit: GB · Stacked");
  includes("| Label | Storage (GB) |");
  includes("| Q1 | 10 |");
  includes("| Q2 | 20 |");

  // donut-chart
  includes("### Traffic share");
  includes("Center label: Total · Center value: 100 · Unit: %");
  includes("| Slice | Value (%) |");
  includes("| Direct | 60 |");
  includes("| Search | 40 |");

  // sparkline
  includes("### Uptime");
  includes("Value: 99.5% · Last 4 days · Trend: up (Improving)");
  includes("| 1 | 98 |");
  includes("| 4 | 100 |");

  // heatmap
  includes("### Cluster load");
  includes("Low: Idle · High: Busy · Unit: qps");
  includes("|  | Mon | Tue | Wed |");
  includes("| API | 10 | 20 |  |");
  includes("| DB | 5 |  | 8 |");

  // status
  includes("### Deploy status");
  includes("| Status | warning |");
  includes("| Label | Deploy pending |");
  includes("| Description | Waiting for approval |");
  includes("| Detail | Run #42 |");

  // key-value
  includes("### Runtime config");
  includes("| Region | us-east-1 |  |");
  includes("| Image | app:2.1 | Signed digest; code |");

  // progress
  includes("### Migration");
  includes("| Tables | 75% | warning | 3 of 4 migrated |");
  includes("| Indexes | 100% | success |  |");

  // checklist
  includes("### Release checklist");
  includes("1. **Run tests** [complete]");
  includes("2. **Update changelog** [current]: Add release notes");
  includes("3. **Tag release** [pending]");

  // callout
  includes("### Before you migrate");
  includes("**Tone:** warning");
  includes("The migration is irreversible.");
  includes("- Back up the database first");
  includes("- Schedule a maintenance window");
});

test("escapes Markdown syntax inside chart and heatmap cells", () => {
  const cards = [
    {
      version: 1,
      id: "escaped-bars",
      type: "bar-chart",
      title: "Escaping",
      labels: ["A|B", "*bold*"],
      series: [{ id: "count", label: "C_ount", values: [1, 2] }],
      fallback: "Escaping chart.",
    },
    {
      version: 1,
      id: "escaped-heatmap",
      type: "heatmap",
      title: "Heat escaping",
      columns: ["X|Y"],
      rows: [{ label: "[cell]", values: [3] }],
      fallback: "Escaping heatmap.",
    },
  ];
  const transformed = transformVisualCardsToMarkdown(cards.map((card) => fenced(card)).join("\n\n"));

  assert.ok(transformed.includes("A\\|B"));
  assert.ok(transformed.includes("\\*bold\\*"));
  assert.ok(transformed.includes("C\\_ount"));
  assert.ok(transformed.includes("X\\|Y"));
  assert.ok(transformed.includes("\\[cell\\]"));
});
