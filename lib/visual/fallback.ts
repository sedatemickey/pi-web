import type { VisualCard } from "./schema";

function inlineMarkdown(value: string): string {
  return value.replace(/[\\`*_[\]<>|]/g, "\\$&").replace(/\r?\n/g, " ");
}

function heading(value: string): string {
  return `### ${inlineMarkdown(value)}`;
}

export function visualCardToMarkdown(card: VisualCard): string {
  if (card.type === "metrics") {
    const rows = card.items.map((item) => {
      const detail = [item.detail, item.trend?.label].filter(Boolean).join("; ");
      return `| ${inlineMarkdown(item.label)} | ${inlineMarkdown(item.value)} | ${inlineMarkdown(detail)} |`;
    });
    return [heading(card.title), "", "| Metric | Value | Detail |", "| --- | --- | --- |", ...rows].join("\n");
  }

  if (card.type === "comparison") {
    const sections = card.items.flatMap((item) => [
      `#### ${inlineMarkdown(item.title)}${item.badge ? ` (${inlineMarkdown(item.badge)})` : ""}`,
      ...(item.summary ? ["", inlineMarkdown(item.summary)] : []),
      "",
      ...item.points.map((point) => `- ${inlineMarkdown(point)}`),
    ]);
    return [heading(card.title), "", ...sections].join("\n");
  }

  const steps = card.items.map((item, index) => {
    const status = item.status ? ` [${item.status}]` : "";
    const description = item.description ? `: ${inlineMarkdown(item.description)}` : "";
    return `${index + 1}. **${inlineMarkdown(item.title)}**${status}${description}`;
  });
  return [heading(card.title), "", ...steps].join("\n");
}
