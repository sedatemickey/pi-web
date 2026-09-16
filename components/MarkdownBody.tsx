"use client";

import { useMemo, type MouseEvent } from "react";
import ReactMarkdown, { type Components, type Options as ReactMarkdownOptions } from "react-markdown";
import { resolveLocalFileHref, shouldOpenLocalFileInApp } from "@/lib/file-links";
import { encodeFilePathForApi } from "@/lib/file-paths";
import { markdownRehypePlugins, markdownRemarkPlugins, markdownUrlTransform, normalizeDisplayMath } from "@/lib/markdown";
import { rehypeVisualCards } from "@/lib/visual/markdown";
import { MermaidBlock, CodeBlock } from "./MermaidBlock";
import { VisualBlock } from "./visual/VisualBlock";

interface MarkdownBodyProps {
  children: string;
  className?: string;
  isStreaming?: boolean;
  allowVisualCards?: boolean;
  cwd?: string;
  onOpenFile?: (filePath: string) => void;
}

const markdownVisualRehypePlugins = [
  ...(markdownRehypePlugins ?? []),
  rehypeVisualCards,
] as NonNullable<ReactMarkdownOptions["rehypePlugins"]>;

export function MarkdownBody({ children, className, isStreaming, allowVisualCards = false, cwd, onOpenFile }: MarkdownBodyProps) {
  const normalizedMarkdown = useMemo(() => normalizeDisplayMath(children), [children]);
  // Stable renderer identities keep stateful blocks mounted across message hover updates.
  const components = useMemo<Components>(() => ({
    code({ node, className, children, ...props }) {
      const lang = className?.replace("language-", "").toLowerCase() ?? "";
      const raw = String(children);
      const blockSource = raw.replace(/\n$/, "");
      const isBlock = className?.includes("language-") || raw.includes("\n");
      if (isBlock) {
        const visualState = node?.properties?.dataPiVisualState;
        if (
          allowVisualCards
          && lang === "pi-ui"
          && (visualState === "complete" || visualState === "incomplete" || visualState === "limit-exceeded")
        ) {
          return <VisualBlock source={blockSource} state={visualState} isStreaming={isStreaming} />;
        }
        if (lang === "mermaid") {
          return (
            <MermaidBlock
              code={blockSource}
              isStreaming={isStreaming}
              defaultPreview
            />
          );
        }
        return <CodeBlock code={blockSource} lang={lang} isStreaming={isStreaming} />;
      }
      return (
        <code
          className="markdown-inline-code"
          {...props}
        >
          {children}
        </code>
      );
    },
    pre({ children }) {
      return <>{children}</>;
    },
    a({ href, children, ...props }) {
      // `node` is react-markdown metadata, not a DOM attribute.
      delete props.node;
      const filePath = onOpenFile ? resolveLocalFileHref(href, cwd) : null;
      const openFile = onOpenFile;
      if (!filePath || !openFile) {
        return (
          <a href={href} {...props} target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        );
      }

      const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
        if (!shouldOpenLocalFileInApp(event)) return;
        const target = event.currentTarget.getAttribute("target");
        if (target && target !== "_self") return;
        event.preventDefault();
        openFile(filePath);
      };

      return (
        <a href={href} {...props} onClick={handleClick}>
          {children}
        </a>
      );
    },
    img({ src, alt, ...props }) {
      delete props.node;
      const filePath = typeof src === "string" ? resolveLocalFileHref(src, cwd) : null;
      const imageSrc = filePath
        ? `/api/files/${encodeFilePathForApi(filePath)}?type=read`
        : src;
      // Dynamic local paths are served directly by the file API.
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={imageSrc} alt={alt ?? ""} loading="lazy" {...props} />;
    },
    table({ children }) {
      return (
        <div className="markdown-table-wrap">
          <table>{children}</table>
        </div>
      );
    },
  }), [allowVisualCards, cwd, isStreaming, onOpenFile]);

  return (
    <div className={["markdown-body", className].filter(Boolean).join(" ")}>
      <ReactMarkdown
        remarkPlugins={markdownRemarkPlugins}
        rehypePlugins={allowVisualCards ? markdownVisualRehypePlugins : markdownRehypePlugins}
        urlTransform={onOpenFile ? markdownUrlTransform : undefined}
        components={components}
      >
        {normalizedMarkdown}
      </ReactMarkdown>
    </div>
  );
}
