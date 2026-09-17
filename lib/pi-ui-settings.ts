import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { writePrivateFileAtomicSync } from "./atomic-file";
import { VISUAL_CARD_TYPES, type VisualCardType } from "./visual/schema";

export const PI_UI_SETTINGS_VERSION = 1;

/** Resolved, complete Pi UI settings. Every protocol component always has a value. */
export interface PiUiSettings {
  enabled: boolean;
  components: Record<VisualCardType, boolean>;
}

/** Partial update accepted by {@link updatePiUiSettings}. */
export interface PiUiSettingsPatch {
  enabled?: boolean;
  components?: Partial<Record<VisualCardType, boolean>>;
}

type StoredPiUiSettings = Record<string, unknown> & {
  version?: unknown;
  enabled?: unknown;
  components?: unknown;
};

const VISUAL_CARD_TYPE_SET: ReadonlySet<string> = new Set(VISUAL_CARD_TYPES);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isVisualCardType(value: string): value is VisualCardType {
  return VISUAL_CARD_TYPE_SET.has(value);
}

/** Missing or malformed values fall back to enabled, so a fresh install enables everything. */
function resolveComponents(stored: unknown): Record<VisualCardType, boolean> {
  const source = isRecord(stored) ? stored : {};
  const components = {} as Record<VisualCardType, boolean>;
  for (const type of VISUAL_CARD_TYPES) {
    const value = source[type];
    components[type] = typeof value === "boolean" ? value : true;
  }
  return components;
}

export function getPiUiSettingsPath(agentDir = getAgentDir()): string {
  return join(agentDir, "pi-ui", "settings.json");
}

function readStoredSettings(settingsPath: string): StoredPiUiSettings {
  if (!existsSync(settingsPath)) return {};
  const parsed: unknown = JSON.parse(readFileSync(settingsPath, "utf8"));
  if (!isRecord(parsed)) {
    throw new Error("Invalid pi-ui settings: expected an object");
  }
  return parsed as StoredPiUiSettings;
}

export function readPiUiSettings(settingsPath = getPiUiSettingsPath()): PiUiSettings {
  const stored = readStoredSettings(settingsPath);
  return {
    enabled: typeof stored.enabled === "boolean" ? stored.enabled : true,
    components: resolveComponents(stored.components),
  };
}

function validatePatch(patch: PiUiSettingsPatch): void {
  if (!isRecord(patch)) throw new Error("pi-ui settings must be an object");
  if (patch.enabled !== undefined && typeof patch.enabled !== "boolean") {
    throw new Error("enabled must be a boolean");
  }
  if (patch.components === undefined) return;
  if (!isRecord(patch.components)) throw new Error("components must be an object");
  for (const [key, value] of Object.entries(patch.components)) {
    if (!isVisualCardType(key)) throw new Error(`Unknown pi-ui component: ${key}`);
    if (typeof value !== "boolean") throw new Error(`pi-ui component ${key} must be a boolean`);
  }
}

export function updatePiUiSettings(
  patch: PiUiSettingsPatch,
  settingsPath = getPiUiSettingsPath(),
): PiUiSettings {
  validatePatch(patch);
  const stored = readStoredSettings(settingsPath);
  const current = readPiUiSettings(settingsPath);

  const components = { ...current.components };
  if (patch.components !== undefined) {
    for (const [key, value] of Object.entries(patch.components)) {
      if (isVisualCardType(key) && typeof value === "boolean") components[key] = value;
    }
  }
  const enabled = patch.enabled === undefined ? current.enabled : patch.enabled;

  mkdirSync(dirname(settingsPath), { recursive: true });
  writePrivateFileAtomicSync(settingsPath, JSON.stringify({
    ...stored,
    version: PI_UI_SETTINGS_VERSION,
    enabled,
    components,
  }, null, 2));
  return readPiUiSettings(settingsPath);
}
