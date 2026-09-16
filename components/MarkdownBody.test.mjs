import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, {
  jsx: { runtime: "automatic" },
  tsconfigPaths: true,
});
const { MarkdownBody } = await jiti.import("./MarkdownBody.tsx");
const { normalizeDisplayMath } = await jiti.import("../lib/markdown.ts");
const { VISUAL_CARD_CATALOG } = await jiti.import("../lib/visual/catalog.ts");
const { I18nProvider } = await jiti.import("@/hooks/useI18n");

function renderMarkdown(markdown, props = {}) {
  return renderToStaticMarkup(
    React.createElement(
      I18nProvider,
      null,
      React.createElement(MarkdownBody, {
        cwd: "/home/me/project",
        onOpenFile() {},
        ...props,
      }, markdown),
    ),
  );
}

test("opens non-file markdown links in a safe new tab", () => {
  const html = renderMarkdown("[docs](https://example.com/docs)");

  assert.match(
    html,
    /<a (?=[^>]*href="https:\/\/example\.com\/docs")(?=[^>]*target="_blank")(?=[^>]*rel="noopener noreferrer")[^>]*>docs<\/a>/,
  );
  assert.doesNotMatch(html, /\snode=/);
});

test("keeps local file markdown links in the app", () => {
  const relativeHtml = renderMarkdown("[file](components/MarkdownBody.tsx)");
  const fileUrlHtml = renderMarkdown("[report](file:///home/me/project/report.html)");

  assert.match(relativeHtml, /<a href="components\/MarkdownBody\.tsx">file<\/a>/);
  assert.doesNotMatch(relativeHtml, /target=|rel=|\snode=/);
  assert.match(fileUrlHtml, /<a href="file:\/\/\/home\/me\/project\/report\.html">report<\/a>/);
  assert.doesNotMatch(fileUrlHtml, /target=|rel=|\snode=/);
});

test("keeps file URLs inert without an in-app file handler", () => {
  const html = renderMarkdown("[report](file:///home/me/project/report.html)", { onOpenFile: undefined });

  assert.match(html, /<a href="" target="_blank" rel="noopener noreferrer">report<\/a>/);
});

test("keeps single-tilde CJK numeric ranges literal instead of striking them", () => {
  const html = renderMarkdown("5~7U 保证金 × 100~200倍杠杆");

  assert.doesNotMatch(html, /<del>/);
  assert.match(html, /5~7U/);
  assert.match(html, /100~200倍/);
});

test("still renders double-tilde strikethrough", () => {
  const html = renderMarkdown("~~gone~~");

  assert.match(html, /<del>gone<\/del>/);
});

test("renders backslash-escaped backticks inside inline code", () => {
  const html = renderMarkdown("`AudioManager\\`1.cs`");

  assert.match(html, /<code[^>]*>AudioManager`1\.cs<\/code>/);
  assert.doesNotMatch(html, /<\/code>1\.cs`/);
});

test("renders LaTeX parenthesis delimiters as inline math", () => {
  const html = renderMarkdown(String.raw`射线为 \(r_c = K^{-1}p\)。`);

  assert.match(html, /class="katex"/);
  assert.match(html, /r_c/);
});

test("renders paired LaTeX bracket delimiters as display math", () => {
  const html = renderMarkdown(String.raw`\[
P(\lambda)=o_b+\lambda r_b
\]`);
  const oneLineHtml = renderMarkdown(String.raw`\[P(\lambda)=o_b+\lambda r_b\]`);

  assert.match(html, /class="katex-display"/);
  assert.match(html, /lambda/);
  assert.match(oneLineHtml, /class="katex-display"/);
});

test("renders model-emitted bracket-only formula lines as display math", () => {
  const html = renderMarkdown(String.raw`平均一致性：

[ C(x) = \frac{2}{T(T-1)} \sum_{i<j} S(\hat{y}^{(i)}, \hat{y}^{(j)}) ]`);

  assert.match(html, /class="katex-display"/);
  assert.match(html, /\\sum/);
});

test("leaves an unmatched LaTeX bracket delimiter unchanged", () => {
  const markdown = String.raw`before
\[
x + y
after`;

  assert.equal(normalizeDisplayMath(markdown), markdown);
});

test("does not normalize LaTeX delimiters inside Markdown code", () => {
  const markdown = "    \\(indented\\)\n\n`code\n\\(inline\\)`\n\n```text\n\\[\nfenced\n\\]\n```";

  assert.equal(normalizeDisplayMath(markdown), markdown);
});

test("does not normalize LaTeX delimiters inside raw HTML code", () => {
  const markdown = "<code>\\(inline\\)</code>\n\n<pre>\n\\(block\\)\n</pre>";

  assert.equal(normalizeDisplayMath(markdown), markdown);
});

test("does not normalize escaped delimiters or link destinations", () => {
  const escaped = String.raw`Literal: \\(x+y\\).`;
  const link = String.raw`[docs](https://example.com/\(manual\))`;

  assert.equal(normalizeDisplayMath(escaped), escaped);
  assert.equal(normalizeDisplayMath(link), link);
});

test("previews completed Mermaid diagrams by default", () => {
  const html = renderMarkdown("```mermaid\ngraph TD\n  A --> B\n```");

  assert.match(html, /mermaid-block-loading/);
  assert.match(html, />Source</);
  assert.doesNotMatch(html, /A --&gt; B/);
});

test("keeps Mermaid source visible while the response is streaming", () => {
  const html = renderMarkdown("```mermaid\ngraph TD\n  A --> B\n```", { isStreaming: true });

  assert.doesNotMatch(html, /mermaid-block-loading/);
  assert.match(html, />Preview</);
  assert.match(html, /A --&gt; B/);
});

function visualFence(card, closing = true) {
  return `\`\`\`pi-ui\n${JSON.stringify(card, null, 2)}${closing ? "\n```" : ""}`;
}

test("renders a valid visual card only when explicitly enabled", () => {
  const markdown = visualFence(VISUAL_CARD_CATALOG.metrics.example);
  const disabled = renderMarkdown(markdown);
  const enabled = renderMarkdown(markdown, { allowVisualCards: true });

  assert.doesNotMatch(disabled, /data-visual-state=/);
  assert.match(disabled, /markdown-code-block/);
  assert.match(enabled, /data-visual-state="complete"/);
  assert.match(enabled, /data-visual-type="metrics"/);
  assert.match(enabled, /visual-metrics/);
  assert.match(enabled, /Release status/);
  assert.doesNotMatch(enabled, /&quot;version&quot;/);
});

test("hides incomplete visual JSON behind a streaming placeholder", () => {
  const markdown = visualFence({ ...VISUAL_CARD_CATALOG.steps.example, fallback: "unfinished-secret" }, false);
  const html = renderMarkdown(markdown, { allowVisualCards: true, isStreaming: true });

  assert.match(html, /data-visual-state="incomplete"/);
  assert.match(html, /aria-busy="true"/);
  assert.doesNotMatch(html, /unfinished-secret/);
});

test("marks an interrupted visual block as an error with source access", () => {
  const markdown = visualFence(VISUAL_CARD_CATALOG.steps.example, false);
  const html = renderMarkdown(markdown, { allowVisualCards: true, isStreaming: false });

  assert.match(html, /data-visual-state="error"/);
  assert.match(html, /This visual card was not completed/);
  assert.match(html, />Source</);
});

test("shows a bounded fallback for a complete card with an invalid schema", () => {
  const invalid = { ...VISUAL_CARD_CATALOG.metrics.example, type: "future-card", fallback: "Readable fallback." };
  const html = renderMarkdown(visualFence(invalid), { allowVisualCards: true });

  assert.match(html, /data-visual-state="error"/);
  assert.match(html, /Readable fallback/);
  assert.match(html, /does not match the supported format/);
});

test("leaves nested pi-ui examples as source", () => {
  const nested = `- Example:\n\n  ${visualFence(VISUAL_CARD_CATALOG.comparison.example).replaceAll("\n", "\n  ")}`;
  const html = renderMarkdown(nested, { allowVisualCards: true });

  assert.doesNotMatch(html, /data-visual-state=/);
  assert.match(html, /markdown-code-block/);
  assert.match(html, /&quot;storage-options&quot;/);
});

test("limits the number of visual cards in one text block", () => {
  const markdown = Array.from({ length: 13 }, (_, index) => visualFence({
    ...VISUAL_CARD_CATALOG.metrics.example,
    id: `metric-${index}`,
  })).join("\n\n");
  const html = renderMarkdown(markdown, { allowVisualCards: true });

  assert.equal((html.match(/data-visual-state="complete"/g) ?? []).length, 12);
  assert.equal((html.match(/data-visual-state="error"/g) ?? []).length, 1);
  assert.match(html, /too many visual cards/);
});
