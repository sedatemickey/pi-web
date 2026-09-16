import {
  MAX_VISUAL_CARD_JSON_DEPTH,
  MAX_VISUAL_CARD_SOURCE_BYTES,
  visualCardSchema,
  type VisualCard,
} from "./schema";

export type VisualCardParseErrorCode = "too_large" | "too_deep" | "invalid_json" | "invalid_schema";

export type VisualCardParseResult =
  | { ok: true; card: VisualCard }
  | { ok: false; code: VisualCardParseErrorCode };

function exceedsJsonDepth(source: string, maxDepth: number): boolean {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (const char of source) {
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === "{" || char === "[") {
      depth += 1;
      if (depth > maxDepth) return true;
    } else if (char === "}" || char === "]") {
      depth = Math.max(0, depth - 1);
    }
  }

  return false;
}

function parseBoundedJson(source: string):
  | { ok: true; value: unknown }
  | { ok: false; code: VisualCardParseErrorCode } {
  if (source.length > MAX_VISUAL_CARD_SOURCE_BYTES) return { ok: false, code: "too_large" };
  if (new TextEncoder().encode(source).byteLength > MAX_VISUAL_CARD_SOURCE_BYTES) {
    return { ok: false, code: "too_large" };
  }
  if (exceedsJsonDepth(source, MAX_VISUAL_CARD_JSON_DEPTH)) return { ok: false, code: "too_deep" };

  try {
    return { ok: true, value: JSON.parse(source) };
  } catch {
    return { ok: false, code: "invalid_json" };
  }
}

export function parseVisualCard(source: string): VisualCardParseResult {
  const json = parseBoundedJson(source);
  if (!json.ok) return json;

  const parsed = visualCardSchema.safeParse(json.value);
  return parsed.success
    ? { ok: true, card: parsed.data }
    : { ok: false, code: "invalid_schema" };
}

export function getVisualCardFallback(source: string): string | null {
  const json = parseBoundedJson(source);
  if (!json.ok || typeof json.value !== "object" || json.value === null || Array.isArray(json.value)) return null;
  const fallback = (json.value as Record<string, unknown>).fallback;
  return typeof fallback === "string" && fallback.length <= 500 && fallback.trim()
    ? fallback
    : null;
}
