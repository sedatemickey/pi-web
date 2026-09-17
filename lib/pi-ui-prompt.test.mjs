import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { tsconfigPaths: true });
const { enabledPiUiTypes } = await jiti.import("./pi-ui-prompt.ts");
const { VISUAL_CARD_TYPES } = await jiti.import("./visual/schema.ts");

function components(value = true) {
  return Object.fromEntries(VISUAL_CARD_TYPES.map((type) => [type, value]));
}

test("returns only globally and individually enabled pi-ui types", () => {
  assert.deepEqual(enabledPiUiTypes({ enabled: false, components: components(true) }), []);
  assert.deepEqual(
    enabledPiUiTypes({
      enabled: true,
      components: { ...components(false), metrics: true, progress: true },
    }),
    ["metrics", "progress"],
  );
});
