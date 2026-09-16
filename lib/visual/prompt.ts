import { VISUAL_CARD_CATALOG } from "./catalog";

export const VISUAL_CARD_PROMPT_MARKER = "<pi-web-visual-cards version=\"1\">";

function buildVisualCardSystemPrompt(): string {
  const catalog = Object.entries(VISUAL_CARD_CATALOG).map(([type, entry]) => (
    `- ${type}: ${entry.description} ${entry.fields}. Example: ${JSON.stringify(entry.example)}`
  ));

  return [
    VISUAL_CARD_PROMPT_MARKER,
    "This client can render trusted visual cards embedded in ordinary Markdown responses.",
    "Use a visual card only when metrics, a comparison, or ordered steps are materially clearer than prose. Keep explanations in Markdown and place each card where it supports the explanation.",
    "Emit each card as one complete fenced code block with the exact language pi-ui. The body must be one strict JSON object. Common fields are version: 1, id, type, title, and fallback.",
    ...catalog,
    "Rules:",
    "- Use only the documented fields and enum values. Do not emit HTML, JavaScript, event handlers, URLs, styles, colors, icons, or executable actions.",
    "- All strings are plain text. Keep cards concise and provide an accurate standalone fallback.",
    "- Never invent metrics or chart-like values. If the facts are uncertain, explain the uncertainty in Markdown instead.",
    "- Do not turn an entire response into cards and do not use a card when a short paragraph or list is clearer.",
    "- To show pi-ui source as an example instead of rendering it, use a json fence or wrap it in a longer outer Markdown fence.",
    "</pi-web-visual-cards>",
  ].join("\n");
}

export const VISUAL_CARD_SYSTEM_PROMPT = buildVisualCardSystemPrompt();

export function appendVisualCardPrompt(base: string[]): string[] {
  return base.some((item) => item.includes(VISUAL_CARD_PROMPT_MARKER))
    ? base
    : [...base, VISUAL_CARD_SYSTEM_PROMPT];
}

export function withVisualCardPrompt(base: string): string {
  if (base.includes(VISUAL_CARD_PROMPT_MARKER)) return base;
  return [base.trim(), VISUAL_CARD_SYSTEM_PROMPT].filter(Boolean).join("\n\n");
}
