import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("./PiUiConfig.tsx", import.meta.url), "utf8");

const VISUAL_CARD_TYPES = [
  "metrics",
  "comparison",
  "steps",
  "tabs",
  "accordion",
  "data-table",
  "bar-chart",
  "line-chart",
  "area-chart",
  "donut-chart",
  "sparkline",
  "heatmap",
  "status",
  "key-value",
  "progress",
  "checklist",
  "callout",
];

const EXPECTED_CATEGORIES = [
  { id: "foundation", types: ["metrics", "comparison", "steps"] },
  { id: "interactive", types: ["tabs", "accordion", "data-table"] },
  { id: "charts", types: ["bar-chart", "line-chart", "area-chart", "donut-chart", "sparkline", "heatmap"] },
  { id: "information", types: ["status", "key-value", "progress", "checklist", "callout"] },
];

test("uses the shared config panel shell with the pi-ui feature strip", () => {
  assert.match(source, /<ConfigPanelShell/);
  assert.match(source, /<ConfigSplitView>/);
  assert.match(source, /<ConfigSidebar>/);
  assert.match(source, /<ConfigDetail>/);
  assert.match(source, /<ConfigFooter/);
  assert.equal((source.match(/className="pi-ui-feature-setting"/g) ?? []).length, 1);
  assert.match(source, /className="pi-ui-feature-copy"/);
  assert.match(source, /className="pi-ui-feature-actions"/);
  assert.match(source, /className="pi-ui-feature-reload-notice"/);
});

test("categorizes every protocol type exactly once across the four groups", () => {
  const block = source.slice(source.indexOf("const PI_UI_CATEGORIES"), source.indexOf("const PI_UI_SECTION"));
  for (const category of EXPECTED_CATEGORIES) {
    assert.match(block, new RegExp(`id: "${category.id}"`));
    assert.ok(
      block.includes(`types: [${category.types.map((type) => `"${type}"`).join(", ")}]`),
      `missing category ${category.id} types`,
    );
  }

  const listed = [...block.matchAll(/"([a-z-]+)"/g)].map((match) => match[1]);
  const types = listed.filter((value) => VISUAL_CARD_TYPES.includes(value));
  assert.deepEqual(types, VISUAL_CARD_TYPES);
  assert.equal(new Set(types).size, VISUAL_CARD_TYPES.length);
});

test("reads and writes partial settings through the pi-ui settings endpoint", () => {
  assert.match(source, /const SETTINGS_ENDPOINT = "\/api\/pi-ui\/settings"/);
  assert.match(source, /function settingsEndpoint\(sessionId: string \| null\): string/);
  assert.match(source, /fetch\(settingsEndpoint\(sessionId\), \{\s*cache: "no-store"/);
  assert.match(source, /method: "PUT"/);
  assert.match(source, /JSON\.stringify\(payload\)/);
  assert.match(source, /const saveSettings = async \(payload: PiUiSettingsPayload\)/);
  assert.match(source, /interface PiUiSettingsPayload \{[\s\S]*?enabled\?: boolean;[\s\S]*?components\?: Partial<Record<VisualCardType, boolean>>/);
  assert.match(source, /saveSettings\(\{ enabled: next \}\)/);
  assert.match(source, /saveSettings\(\{ components: \{ \[selectedType\]: next \} \}\)/);
});

test("applies the complete server state and keeps only known protocol types", () => {
  assert.match(source, /setReloadNeeded\(data\.reloadRequired === true\)/);
  assert.match(source, /function mergeComponents\(source: Partial<Record<VisualCardType, boolean>> \| undefined\)/);
  assert.match(source, /for \(const type of VISUAL_CARD_TYPES\) next\[type\] = source\?\.\[type\] === true/);
  assert.match(source, /setEnabled\(data\.enabled\)/);
});

test("uses server-authoritative reload state and reloads through the agent command", () => {
  assert.match(source, /reloadRequired: data\.reloadRequired === true/);
  assert.match(source, /reloadNeeded && sessionId/);
  assert.match(source, /sendAgentCommand\(sessionId, \{ type: "reload" \}\)/);
  assert.match(source, /fetch\(settingsEndpoint\(sessionId\), \{ cache: "no-store" \}\)/);
  assert.match(source, /onReloaded\?\.\(\)/);
});

test("blocks save and reload races", () => {
  assert.match(source, /if \(savingRef\.current \|\| reloadingRef\.current\) return/);
  assert.match(source, /if \(!sessionId \|\| savingRef\.current \|\| reloadingRef\.current\) return/);
  assert.match(source, /const componentDisabled = !enabled \|\| loading \|\| saving \|\| reloading/);
});

test("fetches the current state on mount so reopening reflects the server", () => {
  assert.match(source, /useEffect\(\(\) => \{[\s\S]*?fetch\(settingsEndpoint\(sessionId\)/);
  assert.match(source, /const controller = new AbortController\(\)/);
  assert.match(source, /return \(\) => controller\.abort\(\)/);
});

test("remembers the selected type globally through the settings navigation helpers", () => {
  assert.match(source, /const PI_UI_SECTION = "pi-ui"/);
  assert.match(source, /getLastSettingsSelection\(PI_UI_SECTION\)/);
  assert.match(source, /setLastSettingsSelection\(PI_UI_SECTION, selectedType\)/);
  assert.match(source, /isVisualCardType\(remembered\) \? remembered : "metrics"/);
});

test("exposes a master switch that disables individual toggles without clearing values", () => {
  assert.match(source, /const componentDisabled = !enabled \|\| loading \|\| saving \|\| reloading/);
  assert.match(source, /disabled=\{componentDisabled\}/);
  assert.match(source, /checked=\{enabled\}[\s\S]*?label=\{t\("piUi\.enabledTitle"\)\}/);
  assert.doesNotMatch(source, /saveSettings\(\{ enabled: next, components/);
  assert.doesNotMatch(source, /setComponents\(emptyComponents\(\)\)/);
});

test("renders a localized detail panel with the protocol type, fields, and a real preview", () => {
  assert.match(source, /const selectedEntry = VISUAL_CARD_CATALOG\[selectedType\]/);
  assert.match(source, /const selectedName = t\(`piUi\.component\.\$\{componentKey\(selectedType\)\}\.name`\)/);
  assert.match(source, /const selectedDescription = t\(`piUi\.component\.\$\{componentKey\(selectedType\)\}\.description`\)/);
  assert.match(source, /\{selectedType\}/);
  assert.match(source, /\{selectedEntry\.fields\}/);
  assert.match(source, /<CardRenderer card=\{selectedEntry\.example\} \/>/);
  assert.match(source, /<pre className="pi-ui-json">\s*<code>\{JSON\.stringify\(selectedEntry\.example, null, 2\)\}<\/code>/);
});

test("converts protocol ids to camelCase translation keys", () => {
  assert.match(source, /function componentKey\(type: VisualCardType\): string/);
  assert.ok(source.includes("type.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase())"));
});

test("provides accessible labels and explicit loading and error states", () => {
  assert.match(source, /aria-label=\{t\("piUi\.selectComponent", \{ name \}\)\}/);
  assert.match(source, /label=\{t\("piUi\.componentToggle", \{ name: selectedName \}\)\}/);
  assert.match(source, /className="pi-ui-loading" role="status"/);
  assert.match(source, /t\("piUi\.loading"\)/);
  assert.match(source, /role="alert"/);
  assert.match(source, /t\("piUi\.error", \{ message: error \}\)/);
});

test("documents that settings never render-gate existing cards", () => {
  assert.match(source, /Settings only affect prompt generation, so existing cards are never render-gated/);
  assert.match(source, /t\("piUi\.promptOnlyNote"\)/);
});
