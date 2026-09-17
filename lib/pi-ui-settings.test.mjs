import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { moduleCache: false });
const {
  PI_UI_SETTINGS_VERSION,
  getPiUiSettingsPath,
  readPiUiSettings,
  updatePiUiSettings,
} = await jiti.import("./pi-ui-settings.ts");
const { VISUAL_CARD_TYPES } = await jiti.import("./visual/schema.ts");

function allEnabled() {
  return Object.fromEntries(VISUAL_CARD_TYPES.map((type) => [type, true]));
}

async function createSettingsPath(t) {
  const root = await mkdtemp(join(tmpdir(), "pi-web-pi-ui-settings-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "pi-ui"), { recursive: true });
  return join(root, "pi-ui", "settings.json");
}

test("settings live under <agentDir>/pi-ui/settings.json", () => {
  const agentDir = join("some", "agent", "dir");
  assert.equal(getPiUiSettingsPath(agentDir), join(agentDir, "pi-ui", "settings.json"));
});

test("defaults enable the global switch and every visual component", async (t) => {
  const settingsPath = await createSettingsPath(t);
  assert.deepEqual(readPiUiSettings(settingsPath), { enabled: true, components: allEnabled() });
});

test("writes persist complete settings with version 1 and preserve unknown top-level fields", async (t) => {
  const settingsPath = await createSettingsPath(t);

  assert.deepEqual(updatePiUiSettings({ enabled: false }, settingsPath), {
    enabled: false,
    components: allEnabled(),
  });
  const first = JSON.parse(await readFile(settingsPath, "utf8"));
  assert.deepEqual(first, {
    version: PI_UI_SETTINGS_VERSION,
    enabled: false,
    components: allEnabled(),
  });
  if (process.platform !== "win32") {
    assert.equal((await stat(settingsPath)).mode & 0o777, 0o600);
  }

  await writeFile(settingsPath, JSON.stringify({ ...first, futureSetting: 3 }));
  const updated = updatePiUiSettings({ components: { metrics: false, "bar-chart": false } }, settingsPath);
  assert.equal(updated.enabled, false);
  assert.equal(updated.components.metrics, false);
  assert.equal(updated.components["bar-chart"], false);
  assert.equal(updated.components.steps, true);
  assert.deepEqual(updated.components, { ...allEnabled(), metrics: false, "bar-chart": false });

  const second = JSON.parse(await readFile(settingsPath, "utf8"));
  assert.deepEqual(second, {
    version: PI_UI_SETTINGS_VERSION,
    enabled: false,
    components: updated.components,
    futureSetting: 3,
  });
});

test("partial component updates only change the supplied component", async (t) => {
  const settingsPath = await createSettingsPath(t);
  updatePiUiSettings({ components: { callout: false } }, settingsPath);
  const settings = updatePiUiSettings({ components: { progress: false } }, settingsPath);
  assert.equal(settings.components.callout, false);
  assert.equal(settings.components.progress, false);
  assert.equal(settings.components.metrics, true);
});

test("missing or malformed individual values fall back to true", async (t) => {
  const settingsPath = await createSettingsPath(t);
  await writeFile(settingsPath, JSON.stringify({
    version: 1,
    enabled: "nope",
    components: { metrics: false, "bar-chart": "yes", callout: null },
  }));

  assert.deepEqual(readPiUiSettings(settingsPath), {
    enabled: true,
    components: { ...allEnabled(), metrics: false },
  });
});

test("non-object stored payloads are rejected", async (t) => {
  const settingsPath = await createSettingsPath(t);
  await writeFile(settingsPath, "[]");
  assert.throws(() => readPiUiSettings(settingsPath), /expected an object/);
});

test("updates reject unknown component names and non-boolean values", async (t) => {
  const settingsPath = await createSettingsPath(t);

  assert.throws(
    () => updatePiUiSettings({ components: { nope: true } }, settingsPath),
    /Unknown pi-ui component: nope/,
  );
  assert.throws(
    () => updatePiUiSettings({ components: { metrics: "yes" } }, settingsPath),
    /pi-ui component metrics must be a boolean/,
  );
  assert.throws(
    () => updatePiUiSettings({ enabled: "yes" }, settingsPath),
    /enabled must be a boolean/,
  );
  assert.throws(
    () => updatePiUiSettings({ components: null }, settingsPath),
    /components must be an object/,
  );

  assert.equal(existsSync(settingsPath), false);
});

test("damaged settings fail closed and are not overwritten", async (t) => {
  const settingsPath = await createSettingsPath(t);
  await writeFile(settingsPath, "{");

  assert.throws(() => readPiUiSettings(settingsPath));
  assert.throws(() => updatePiUiSettings({ enabled: false }, settingsPath));
  assert.equal(await readFile(settingsPath, "utf8"), "{");
});
