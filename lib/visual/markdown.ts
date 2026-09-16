import type { Element, Root } from "hast";
import type { Plugin } from "unified";
import { inspectVisualFence } from "./fence";
import { MAX_VISUAL_CARDS_PER_TEXT_BLOCK } from "./schema";

export type VisualFenceRenderState = "complete" | "incomplete" | "limit-exceeded";

function elementChild(node: Element, tagName: string): Element | null {
  return node.children.find(
    (child): child is Element => child.type === "element" && child.tagName === tagName,
  ) ?? null;
}

function hasLanguage(node: Element, language: string): boolean {
  const classNames = node.properties?.className;
  return Array.isArray(classNames) && classNames.includes(`language-${language}`);
}

export const rehypeVisualCards: Plugin<[], Root> = function rehypeVisualCardsPlugin() {
  return (tree, file) => {
    const source = String(file.value);
    let visualCount = 0;

    for (const child of tree.children) {
      if (child.type !== "element" || child.tagName !== "pre") continue;
      const code = elementChild(child, "code");
      if (!code || !hasLanguage(code, "pi-ui")) continue;

      const syntax = inspectVisualFence(source, child.position ?? code.position);
      if (!syntax) continue;

      visualCount += 1;
      const state: VisualFenceRenderState = visualCount > MAX_VISUAL_CARDS_PER_TEXT_BLOCK
        ? "limit-exceeded"
        : syntax.closed
          ? "complete"
          : "incomplete";
      code.properties = { ...code.properties, dataPiVisualState: state };
    }
  };
};
