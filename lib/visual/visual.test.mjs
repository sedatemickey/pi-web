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
