import type { VisualContentBlock } from "./schema";

export function visualContentBlocksText(blocks: readonly VisualContentBlock[]): string {
  return blocks.map((block) => {
    switch (block.type) {
      case "text":
        return block.text;
      case "list":
        return block.items.join(" ");
      case "key-value":
        return block.items.map((item) => `${item.label} ${item.value}`).join(" ");
      case "code":
        return `${block.language ?? ""} ${block.code}`;
      case "table":
        return `${block.columns.join(" ")} ${block.rows.flat().join(" ")}`;
    }
  }).join(" ");
}
