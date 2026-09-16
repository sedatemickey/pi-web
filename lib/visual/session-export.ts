import { transformVisualCardsToMarkdown } from "./markdown-source";

interface TransformResult {
  content: string;
  changed: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function transformAssistantMessage(message: Record<string, unknown>): Record<string, unknown> | null {
  if (message.role !== "assistant") return null;
  const content = message.content;

  if (typeof content === "string") {
    const transformed = transformVisualCardsToMarkdown(content);
    return transformed === content ? null : { ...message, content: transformed };
  }
  if (!Array.isArray(content)) return null;

  let changed = false;
  const transformedContent = content.map((block) => {
    if (!isRecord(block) || block.type !== "text" || typeof block.text !== "string") return block;
    const text = transformVisualCardsToMarkdown(block.text);
    if (text === block.text) return block;
    changed = true;
    return { ...block, text };
  });
  return changed ? { ...message, content: transformedContent } : null;
}

export function transformSessionJsonlVisualCards(source: string): TransformResult {
  const lineBreak = source.includes("\r\n") ? "\r\n" : "\n";
  const lines = source.split(/\r?\n/);
  let changed = false;

  const transformedLines = lines.map((line) => {
    if (!line.trim()) return line;

    let entry: unknown;
    try {
      entry = JSON.parse(line);
    } catch {
      return line;
    }
    if (!isRecord(entry) || entry.type !== "message" || !isRecord(entry.message)) return line;

    const message = transformAssistantMessage(entry.message);
    if (!message) return line;
    changed = true;
    return JSON.stringify({ ...entry, message });
  });

  return { content: transformedLines.join(lineBreak), changed };
}
