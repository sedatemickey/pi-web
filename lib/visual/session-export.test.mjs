import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { tsconfigPaths: true });
const { VISUAL_CARD_CATALOG } = await jiti.import("./catalog.ts");
const { transformSessionJsonlVisualCards } = await jiti.import("./session-export.ts");

function visualFence(card, closed = true) {
  return `\`\`\`pi-ui\n${JSON.stringify(card)}${closed ? "\n```" : ""}`;
}

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

test("supports legacy assistant string content", () => {
  const message = {
    type: "message",
    message: { role: "assistant", content: visualFence(VISUAL_CARD_CATALOG.steps.example) },
  };
  const result = transformSessionJsonlVisualCards(`${JSON.stringify(message)}\n`);

  assert.equal(result.changed, true);
  assert.match(JSON.parse(result.content).message.content, /### Deployment/);
});
