import { fromMarkdown } from "mdast-util-from-markdown";
import type { Code, RootContent } from "mdast";
import { visualCardToMarkdown } from "./fallback";
import { inspectVisualFence } from "./fence";
import { parseVisualCard } from "./parse";

export { inspectVisualFence } from "./fence";

function isTopLevelVisualCode(node: RootContent): node is Code {
  return node.type === "code" && node.lang?.toLowerCase() === "pi-ui" && !node.meta;
}

interface Replacement {
  start: number;
  end: number;
  markdown: string;
}

export function transformVisualCardsToMarkdown(markdown: string): string {
  let tree: ReturnType<typeof fromMarkdown>;
  try {
    tree = fromMarkdown(markdown);
  } catch {
    return markdown;
  }
  const replacements: Replacement[] = [];

  for (const node of tree.children) {
    if (!isTopLevelVisualCode(node)) continue;
    const syntax = inspectVisualFence(markdown, node.position);
    const start = node.position?.start.offset;
    const end = node.position?.end.offset;
    if (!syntax?.closed || start === undefined || end === undefined) continue;

    const parsed = parseVisualCard(node.value);
    if (!parsed.ok) continue;
    replacements.push({ start, end, markdown: visualCardToMarkdown(parsed.card) });
  }

  let result = markdown;
  for (const replacement of replacements.reverse()) {
    result = `${result.slice(0, replacement.start)}${replacement.markdown}${result.slice(replacement.end)}`;
  }
  return result;
}
