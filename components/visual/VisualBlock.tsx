"use client";

import { memo, useMemo, useRef, useState } from "react";
import { useI18n } from "@/hooks/useI18n";
import { getVisualCardFallback, parseVisualCard, type VisualCardParseErrorCode } from "@/lib/visual/parse";
import type { VisualFenceRenderState } from "@/lib/visual/markdown";
import { CodeBlock } from "../MermaidBlock";
import { CardRenderer } from "./CardRenderer";
import { VisualErrorBoundary } from "./VisualErrorBoundary";

interface VisualBlockProps {
  source: string;
  state: VisualFenceRenderState;
  isStreaming?: boolean;
}

function errorKey(code: VisualCardParseErrorCode): string {
  switch (code) {
    case "too_large": return "visual.error.tooLarge";
    case "too_deep": return "visual.error.tooDeep";
    case "invalid_json": return "visual.error.invalidJson";
    case "invalid_schema": return "visual.error.invalidSchema";
  }
}

export const VisualBlock = memo(function VisualBlock({ source, state, isStreaming }: VisualBlockProps) {
  const { t } = useI18n();
  const [showSource, setShowSource] = useState(false);
  const cardToggleRef = useRef<HTMLButtonElement>(null);
  const sourceToggleRef = useRef<HTMLButtonElement>(null);
  const parsed = useMemo(() => state === "complete" ? parseVisualCard(source) : null, [source, state]);
  const fallback = useMemo(() => parsed && !parsed.ok ? getVisualCardFallback(source) : null, [parsed, source]);

  const setSourceVisible = (visible: boolean) => {
    setShowSource(visible);
    requestAnimationFrame(() => {
      (visible ? sourceToggleRef : cardToggleRef).current?.focus();
    });
  };

  if (showSource && (!parsed || !parsed.ok)) {
    return (
      <CodeBlock
        code={source}
        lang="pi-ui"
        headerAction={(
          <button ref={sourceToggleRef} type="button" className="markdown-code-action" onClick={() => setSourceVisible(false)}>
            {t("visual.showCard")}
          </button>
        )}
      />
    );
  }

  if (state === "incomplete" && isStreaming) {
    return (
      <div className="visual-block visual-block-loading" data-visual-state="incomplete" aria-busy="true" aria-label={t("visual.generating")}>
        <div className="visual-loading-line is-heading" />
        <div className="visual-loading-grid">
          <div className="visual-loading-cell" />
          <div className="visual-loading-cell" />
          <div className="visual-loading-cell" />
        </div>
      </div>
    );
  }

  const error = state === "limit-exceeded"
    ? t("visual.error.tooMany")
    : state === "incomplete"
      ? t("visual.error.incomplete")
      : parsed && !parsed.ok
        ? t(errorKey(parsed.code))
        : null;

  if (error || !parsed || !parsed.ok) {
    return (
      <section className="visual-block visual-block-error" data-visual-state="error" aria-label={t("visual.card")}>
        <div className="visual-block-header">
          <h3>{t("visual.card")}</h3>
          <button ref={cardToggleRef} type="button" className="visual-source-button" onClick={() => setSourceVisible(true)}>
            {t("visual.showSource")}
          </button>
        </div>
        <div className="visual-error-body" role="status">
          <span>{error ?? t("visual.error.invalidSchema")}</span>
          {fallback && <p>{fallback}</p>}
        </div>
      </section>
    );
  }

  return (
    <>
      {showSource && (
        <CodeBlock
          code={source}
          lang="pi-ui"
          headerAction={(
            <button ref={sourceToggleRef} type="button" className="markdown-code-action" onClick={() => setSourceVisible(false)}>
              {t("visual.showCard")}
            </button>
          )}
        />
      )}
      <section
        className="visual-block"
        data-visual-state="complete"
        data-visual-type={parsed.card.type}
        aria-label={parsed.card.title}
        hidden={showSource}
      >
        <div className="visual-block-header">
          <h3>{parsed.card.title}</h3>
          <button ref={cardToggleRef} type="button" className="visual-source-button" onClick={() => setSourceVisible(true)}>
            {t("visual.showSource")}
          </button>
        </div>
        <VisualErrorBoundary fallback={<div className="visual-error-body" role="status">{t("visual.error.render")}</div>}>
          <CardRenderer card={parsed.card} />
        </VisualErrorBoundary>
      </section>
    </>
  );
});
