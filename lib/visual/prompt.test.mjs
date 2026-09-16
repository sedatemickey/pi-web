import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { tsconfigPaths: true });
const { VISUAL_CARD_CATALOG } = await jiti.import("./catalog.ts");
const {
  VISUAL_CARD_PROMPT_MARKER,
  VISUAL_CARD_SYSTEM_PROMPT,
  appendVisualCardPrompt,
  withVisualCardPrompt,
} = await jiti.import("./prompt.ts");

for (const [type, entry] of Object.entries(VISUAL_CARD_CATALOG)) {
  test(`includes the validated ${type} example in the system prompt`, () => {
    assert.match(VISUAL_CARD_SYSTEM_PROMPT, new RegExp(`- ${type}:`));
    assert.ok(VISUAL_CARD_SYSTEM_PROMPT.includes(JSON.stringify(entry.example)));
  });
}

test("keeps the protocol prompt bounded and states the execution restrictions", () => {
  assert.ok(VISUAL_CARD_SYSTEM_PROMPT.length < 3_000);
  assert.match(VISUAL_CARD_SYSTEM_PROMPT, /Do not emit HTML, JavaScript, event handlers, URLs, styles, colors, icons, or executable actions/);
  assert.match(VISUAL_CARD_SYSTEM_PROMPT, /Never invent metrics/);
  assert.match(VISUAL_CARD_SYSTEM_PROMPT, /exact language pi-ui/);
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
