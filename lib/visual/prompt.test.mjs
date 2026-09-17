import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { tsconfigPaths: true });
const { VISUAL_CARD_CATALOG } = await jiti.import("./catalog.ts");
const {
  VISUAL_CARD_PROMPT_MARKER,
  VISUAL_CARD_SYSTEM_PROMPT,
  appendVisualCardPrompt,
  buildVisualCardSystemPrompt,
  withVisualCardPrompt,
} = await jiti.import("./prompt.ts");

for (const [type, entry] of Object.entries(VISUAL_CARD_CATALOG)) {
  test(`includes the validated ${type} example in the system prompt`, () => {
    assert.match(VISUAL_CARD_SYSTEM_PROMPT, new RegExp(`- ${type}:`));
    assert.ok(VISUAL_CARD_SYSTEM_PROMPT.includes(JSON.stringify(entry.example)));
  });
}

test("keeps the protocol prompt bounded and states the execution restrictions", () => {
  assert.ok(VISUAL_CARD_SYSTEM_PROMPT.length < 16_000);
  assert.match(VISUAL_CARD_SYSTEM_PROMPT, /Do not emit HTML, JavaScript, event handlers, URLs, styles, colors, icons, or executable actions/);
  assert.match(VISUAL_CARD_SYSTEM_PROMPT, /Never invent metrics/);
  assert.match(VISUAL_CARD_SYSTEM_PROMPT, /local display behavior, not actions/);
  assert.match(VISUAL_CARD_SYSTEM_PROMPT, /text<=1000 chars/);
  assert.match(VISUAL_CARD_SYSTEM_PROMPT, /items: 1-12 strings<=300 chars/);
  assert.match(VISUAL_CARD_SYSTEM_PROMPT, /language matches \^\[A-Za-z0-9_\+\-\]\{1,24\}\$/);
  assert.match(VISUAL_CARD_SYSTEM_PROMPT, /cells<=240 chars/);
  assert.match(VISUAL_CARD_SYSTEM_PROMPT, /item ids match \^\[A-Za-z\]/);
  assert.match(VISUAL_CARD_SYSTEM_PROMPT, /chart series and data-table column ids match \^\[A-Za-z\]\[A-Za-z0-9_-\]\{0,31\}\$/);
  assert.match(VISUAL_CARD_SYSTEM_PROMPT, /status cells use neutral\|success\|warning\|error/);
  assert.match(VISUAL_CARD_SYSTEM_PROMPT, /exact language pi-ui/);
});

test("documents chart/matrix alignment, fixed enums, and static local chart behavior", () => {
  assert.match(VISUAL_CARD_SYSTEM_PROMPT, /Chart and matrix rules/);
  assert.match(VISUAL_CARD_SYSTEM_PROMPT, /exactly one finite number or null per label/);
  assert.match(VISUAL_CARD_SYSTEM_PROMPT, /exactly one entry per column/);
  assert.match(VISUAL_CARD_SYSTEM_PROMPT, /at least one positive value/);
  assert.match(VISUAL_CARD_SYSTEM_PROMPT, /Never provide colors, palettes, sizes, styles, number formats, axis ranges, or other chart options/);
  assert.match(VISUAL_CARD_SYSTEM_PROMPT, /static and browser-local: no zoom, pan, drill-down, live data, or external requests/);
  assert.match(VISUAL_CARD_SYSTEM_PROMPT, /Fixed enums: status and callout tone are neutral\|info\|success\|warning\|error/);
  assert.match(VISUAL_CARD_SYSTEM_PROMPT, /progress status is neutral\|success\|warning\|error/);
  assert.match(VISUAL_CARD_SYSTEM_PROMPT, /sparkline trend direction is up\|down\|flat/);
  assert.match(VISUAL_CARD_SYSTEM_PROMPT, /checklist status is complete\|current\|pending/);
  assert.match(VISUAL_CARD_SYSTEM_PROMPT, /key-value style is text\|code/);
  assert.match(VISUAL_CARD_SYSTEM_PROMPT, /progress values are numbers from 0 to 100/);
  assert.match(VISUAL_CARD_SYSTEM_PROMPT, /static local views, not live dashboards/);
  for (const type of ["bar-chart", "line-chart", "area-chart", "donut-chart", "sparkline", "heatmap", "status", "key-value", "progress", "checklist", "callout"]) {
    assert.match(VISUAL_CARD_SYSTEM_PROMPT, new RegExp(`- ${type}:`));
  }
});

test("filters disabled component types and omits the capability when none are enabled", () => {
  const filtered = buildVisualCardSystemPrompt(["metrics", "progress"]);
  assert.match(filtered, /- metrics:/);
  assert.match(filtered, /- progress:/);
  assert.doesNotMatch(filtered, /- tabs:/);
  assert.doesNotMatch(filtered, /- bar-chart:/);
  assert.doesNotMatch(filtered, /data-table date cells/);
  assert.doesNotMatch(filtered, /Chart and matrix rules/);
  assert.equal(buildVisualCardSystemPrompt([]), "");

  const base = ["User append prompt"];
  assert.strictEqual(appendVisualCardPrompt(base, []), base);
  assert.equal(withVisualCardPrompt("Profile prompt", []), "Profile prompt");
});

test("appends the capability without replacing or duplicating existing prompts", () => {
  const base = ["User append prompt"];
  const appended = appendVisualCardPrompt(base);
  assert.deepEqual(base, ["User append prompt"]);
  assert.equal(appended[0], "User append prompt");
  assert.equal(appended[1], VISUAL_CARD_SYSTEM_PROMPT);
  assert.strictEqual(appendVisualCardPrompt(appended), appended);

  const exact = withVisualCardPrompt("Profile prompt");
  assert.ok(exact.startsWith("Profile prompt\n\n"));
  assert.equal(exact.split(VISUAL_CARD_PROMPT_MARKER).length - 1, 1);
  assert.equal(withVisualCardPrompt(exact), exact);
});
