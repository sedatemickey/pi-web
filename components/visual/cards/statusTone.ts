"use client";

import { useI18n } from "@/hooks/useI18n";

/** Semantic tones shared by status, progress, and callout cards. */
export type SemanticTone = "neutral" | "info" | "success" | "warning" | "error";

// Reuse keys that already exist in every locale so no new translations are needed.
const TONE_LABEL_KEYS: Record<SemanticTone, string> = {
  neutral: "visual.table.status.neutral",
  info: "visual.accordion.status.neutral",
  success: "visual.table.status.success",
  warning: "visual.table.status.warning",
  error: "visual.table.status.error",
};

/** Localized renderer-controlled label for a card tone. */
export function useToneLabel(tone: SemanticTone): string {
  const { t } = useI18n();
  return t(TONE_LABEL_KEYS[tone]);
}