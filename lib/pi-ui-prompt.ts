import type { PiUiSettings } from "./pi-ui-settings";
import { readPiUiSettings } from "./pi-ui-settings";
import { appendVisualCardPrompt, withVisualCardPrompt } from "./visual/prompt";
import { VISUAL_CARD_TYPES, type VisualCardType } from "./visual/schema";

export function enabledPiUiTypes(settings: PiUiSettings): VisualCardType[] {
  if (!settings.enabled) return [];
  return VISUAL_CARD_TYPES.filter((type) => settings.components[type]);
}

function readEnabledPiUiTypes(): VisualCardType[] {
  try {
    return enabledPiUiTypes(readPiUiSettings());
  } catch (error) {
    console.error(
      "[pi-web] failed to read pi-ui settings; visual-card prompting is disabled:",
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}

export function appendConfiguredPiUiPrompt(base: string[]): string[] {
  return appendVisualCardPrompt(base, readEnabledPiUiTypes());
}

export function withConfiguredPiUiPrompt(base: string): string {
  return withVisualCardPrompt(base, readEnabledPiUiTypes());
}
