import type { Position } from "unist";

export interface VisualFenceSyntax {
  marker: "`" | "~";
  size: number;
  closed: boolean;
}

function sourceLine(source: string, start: number, end: number): string {
  return source.slice(start, end).replace(/\r$/, "");
}

export function inspectVisualFence(source: string, position: Position | undefined): VisualFenceSyntax | null {
  const start = position?.start.offset;
  const end = position?.end.offset;
  if (start === undefined || end === undefined || start < 0 || end <= start) return null;

  const firstLineEnd = source.indexOf("\n", start);
  const openingEnd = firstLineEnd === -1 || firstLineEnd > end ? end : firstLineEnd;
  const opening = sourceLine(source, start, openingEnd);
  const openingMatch = opening.match(/^ {0,3}(`{3,}|~{3,})pi-ui[ \t]*$/i);
  if (!openingMatch) return null;

  const openingFence = openingMatch[1];
  const marker = openingFence[0] as "`" | "~";
  const lastLineStart = source.lastIndexOf("\n", end - 1) + 1;
  const closing = sourceLine(source, lastLineStart, end);
  const closingPattern = new RegExp(`^ {0,3}${marker}{${openingFence.length},}[ \\t]*$`);

  return {
    marker,
    size: openingFence.length,
    closed: lastLineStart > openingEnd && closingPattern.test(closing),
  };
}
