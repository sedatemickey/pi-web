import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { moduleCache: false });
const {
  advancePiUiSettingsGeneration,
  clearPiUiSessionGeneration,
  clearPiUiStartingSessionGeneration,
  getPiUiSettingsGeneration,
  isPiUiSessionPromptStale,
  setPiUiSessionGeneration,
  setPiUiStartingSessionGeneration,
} = await jiti.import("./pi-ui-session-state.ts");

test("advances the process-wide Pi UI settings generation monotonically", () => {
  delete globalThis.__piUiSettingsGeneration;
  assert.equal(getPiUiSettingsGeneration(), 0);
  assert.equal(advancePiUiSettingsGeneration(), 1);
  assert.equal(advancePiUiSettingsGeneration(), 2);
  assert.equal(getPiUiSettingsGeneration(), 2);
  delete globalThis.__piUiSettingsGeneration;
  globalThis.__piUiSessionGenerations?.clear();
  globalThis.__piUiStartingSessionGenerations?.clear();
});

test("compares each live session generation with the global settings generation", () => {
  delete globalThis.__piUiSettingsGeneration;
  globalThis.__piUiSessionGenerations?.clear();
  globalThis.__piUiStartingSessionGenerations?.clear();
  setPiUiSessionGeneration("one", 0);
  setPiUiSessionGeneration("two", 0);
  assert.equal(isPiUiSessionPromptStale("one"), false);

  advancePiUiSettingsGeneration();
  assert.equal(isPiUiSessionPromptStale("one"), true);
  assert.equal(isPiUiSessionPromptStale("two"), true);
  assert.equal(isPiUiSessionPromptStale("dormant"), false);

  setPiUiSessionGeneration("one", getPiUiSettingsGeneration());
  assert.equal(isPiUiSessionPromptStale("one"), false);
  assert.equal(isPiUiSessionPromptStale("two"), true);
  clearPiUiSessionGeneration("two");
  assert.equal(isPiUiSessionPromptStale("two"), false);

  delete globalThis.__piUiSettingsGeneration;
  globalThis.__piUiSessionGenerations?.clear();
  globalThis.__piUiStartingSessionGenerations?.clear();
});

test("keeps a session stale throughout startup until its wrapper takes over", () => {
  delete globalThis.__piUiSettingsGeneration;
  globalThis.__piUiSessionGenerations?.clear();
  globalThis.__piUiStartingSessionGenerations?.clear();
  setPiUiStartingSessionGeneration("starting", getPiUiSettingsGeneration());
  advancePiUiSettingsGeneration();
  assert.equal(isPiUiSessionPromptStale("starting"), true);

  setPiUiSessionGeneration("starting", 0);
  clearPiUiStartingSessionGeneration("starting");
  assert.equal(isPiUiSessionPromptStale("starting"), true);
  setPiUiSessionGeneration("starting", getPiUiSettingsGeneration());
  assert.equal(isPiUiSessionPromptStale("starting"), false);

  clearPiUiSessionGeneration("starting");
  delete globalThis.__piUiSettingsGeneration;
  globalThis.__piUiStartingSessionGenerations?.clear();
});
