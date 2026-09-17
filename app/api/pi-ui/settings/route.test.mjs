import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after } from "node:test";
import { createJiti } from "jiti";

const originalAgentDir = process.env.PI_CODING_AGENT_DIR;
const testAgentDir = await mkdtemp(join(tmpdir(), "pi-web-pi-ui-settings-route-"));
process.env.PI_CODING_AGENT_DIR = testAgentDir;

const jiti = createJiti(import.meta.url, {
  alias: { "@": process.cwd() },
  interopDefault: true,
  moduleCache: false,
});
const { GET, PUT } = await jiti.import("./route.ts");
const { VISUAL_CARD_TYPES } = await jiti.import("@/lib/visual/schema.ts");
const {
  clearPiUiSessionGeneration,
  clearPiUiStartingSessionGeneration,
  getPiUiSettingsGeneration,
  setPiUiSessionGeneration,
  setPiUiStartingSessionGeneration,
} = await jiti.import("@/lib/pi-ui-session-state.ts");

const settingsPath = join(testAgentDir, "pi-ui", "settings.json");

after(async () => {
  if (originalAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
  else process.env.PI_CODING_AGENT_DIR = originalAgentDir;
  await rm(testAgentDir, { recursive: true, force: true });
});

function allEnabled() {
  return Object.fromEntries(VISUAL_CARD_TYPES.map((type) => [type, true]));
}

function request(body, { contentType = "application/json", host = "localhost", method = "PUT", sessionId } = {}) {
  const query = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : "";
  return new Request(`http://localhost/api/pi-ui/settings${query}`, {
    method,
    headers: { "Content-Type": contentType, Host: host },
    body: JSON.stringify(body),
  });
}

test("GET returns the complete default settings", async () => {
  const response = await GET();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { enabled: true, components: allEnabled() });
});

test("PUT persists a partial update and returns complete settings", async () => {
  let response = await PUT(request({ enabled: false }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { enabled: false, components: allEnabled() });

  response = await PUT(request({ components: { metrics: false } }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    enabled: false,
    components: { ...allEnabled(), metrics: false },
  });

  const stored = JSON.parse(await readFile(settingsPath, "utf8"));
  assert.equal(stored.version, 1);
  assert.equal(stored.enabled, false);
  assert.equal(stored.components.metrics, false);
  assert.equal(stored.components.callout, true);

  response = await GET();
  assert.deepEqual(await response.json(), {
    enabled: false,
    components: { ...allEnabled(), metrics: false },
  });
});

test("reports server-authoritative reload state for live sessions", async () => {
  const sessionId = "live-session";
  setPiUiSessionGeneration(sessionId, getPiUiSettingsGeneration());
  let response = await GET(new Request(`http://localhost/api/pi-ui/settings?sessionId=${sessionId}`));
  assert.equal((await response.json()).reloadRequired, false);

  response = await PUT(request({ components: { comparison: false } }, { sessionId }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).reloadRequired, true);

  setPiUiSessionGeneration(sessionId, getPiUiSettingsGeneration());
  response = await GET(new Request(`http://localhost/api/pi-ui/settings?sessionId=${sessionId}`));
  assert.equal((await response.json()).reloadRequired, false);
  clearPiUiSessionGeneration(sessionId);
});

test("reports stale while a session is still starting", async () => {
  const sessionId = "starting-session";
  setPiUiStartingSessionGeneration(sessionId, getPiUiSettingsGeneration());
  const response = await PUT(request({ components: { steps: false } }, { sessionId }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).reloadRequired, true);
  clearPiUiStartingSessionGeneration(sessionId);
});

test("PUT preserves unknown top-level stored fields", async () => {
  await writeFile(settingsPath, JSON.stringify({
    version: 1,
    enabled: true,
    components: allEnabled(),
    futureSetting: 9,
  }));
  const response = await PUT(request({ components: { steps: false } }));
  assert.equal(response.status, 200);
  const stored = JSON.parse(await readFile(settingsPath, "utf8"));
  assert.equal(stored.futureSetting, 9);
  assert.equal(stored.components.steps, false);
});

test("PUT rejects unknown body fields and empty mutations", async () => {
  let response = await PUT(request({ extra: true }));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Unknown field: extra" });

  response = await PUT(request({}));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "enabled or components is required" });
});

test("PUT rejects invalid values with 400", async () => {
  let response = await PUT(request({ enabled: "yes" }));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "enabled must be a boolean" });

  response = await PUT(request({ components: { nope: true } }));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Unknown pi-ui component: nope" });

  response = await PUT(request({ components: { metrics: "yes" } }));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "pi-ui component metrics must be a boolean" });

  response = await PUT(request({ components: [] }));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "components must be an object" });
});

test("PUT enforces request security and JSON content type", async () => {
  let response = await PUT(request({ enabled: true }, { contentType: "text/plain" }));
  assert.equal(response.status, 415);
  assert.deepEqual(await response.json(), { error: "Content-Type must be application/json" });

  response = await PUT(request({ enabled: true }, { host: "evil.example" }));
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "Untrusted API request" });
});

test("GET returns 500 for damaged settings", async () => {
  const backup = await readFile(settingsPath, "utf8");
  await writeFile(settingsPath, "{");
  const response = await GET();
  assert.equal(response.status, 500);
  assert.match((await response.json()).error, /JSON/);
  await writeFile(settingsPath, backup);
});
