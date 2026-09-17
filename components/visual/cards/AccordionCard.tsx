"use client";

import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useI18n } from "@/hooks/useI18n";
import { visualContentBlocksText } from "@/lib/visual/content";
import type { AccordionCard } from "@/lib/visual/schema";
import { ContentBlocks } from "../ContentBlocks";

function initialOpenItem(card: AccordionCard): string {
  return card.items.find((item) => item.status === "error")?.id ?? card.items[0].id;
}

export function AccordionCardView({ card }: { card: AccordionCard }) {
  const { t } = useI18n();
  const [openItems, setOpenItems] = useState<Set<string>>(() => new Set([initialOpenItem(card)]));
  const [query, setQuery] = useState("");
  const headersRef = useRef<Array<HTMLButtonElement | null>>([]);
  const instanceId = useId().replaceAll(":", "");
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleItems = useMemo(() => {
    if (!normalizedQuery) return card.items;
    return card.items.filter((item) => (
      `${item.title} ${item.summary ?? ""} ${visualContentBlocksText(item.blocks)}`
        .toLocaleLowerCase()
        .includes(normalizedQuery)
    ));
  }, [card.items, normalizedQuery]);

  const toggle = (id: string) => {
    setOpenItems((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onHeaderKeyDown = (event: KeyboardEvent<HTMLButtonElement>, visibleIndex: number) => {
    let nextIndex: number | null = null;
    if (event.key === "ArrowDown") nextIndex = (visibleIndex + 1) % visibleItems.length;
    else if (event.key === "ArrowUp") nextIndex = (visibleIndex - 1 + visibleItems.length) % visibleItems.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = visibleItems.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    const targetId = visibleItems[nextIndex]?.id;
    const originalIndex = card.items.findIndex((item) => item.id === targetId);
    headersRef.current[originalIndex]?.focus();
  };

  const allVisibleOpen = visibleItems.length > 0 && visibleItems.every((item) => openItems.has(item.id));

  return (
    <div className="visual-accordion">
      <div className="visual-accordion-toolbar">
        {card.items.length >= 4 && (
          <input
            type="search"
            className="visual-control-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("visual.accordion.search")}
            aria-label={t("visual.accordion.search")}
          />
        )}
        {!normalizedQuery && visibleItems.length > 1 && (
          <button
            type="button"
            className="visual-control-button"
            onClick={() => {
              if (allVisibleOpen) {
                setOpenItems((current) => {
                  const next = new Set(current);
                  visibleItems.forEach((item) => next.delete(item.id));
                  return next;
                });
              } else {
                setOpenItems((current) => new Set([...current, ...visibleItems.map((item) => item.id)]));
              }
            }}
          >
            {allVisibleOpen ? t("visual.accordion.collapseAll") : t("visual.accordion.expandAll")}
          </button>
        )}
      </div>
      {visibleItems.length === 0 && <p className="visual-empty-state">{t("visual.accordion.noMatches")}</p>}
      {visibleItems.map((item, visibleIndex) => {
        const originalIndex = card.items.findIndex((candidate) => candidate.id === item.id);
        const expanded = normalizedQuery.length > 0 || openItems.has(item.id);
        const buttonId = `visual-accordion-button-${instanceId}-${item.id}`;
        const panelId = `visual-accordion-panel-${instanceId}-${item.id}`;
        return (
          <section className="visual-accordion-item" data-status={item.status ?? "neutral"} key={item.id}>
            <h4>
              <button
                type="button"
                className="visual-accordion-trigger"
                id={buttonId}
                aria-expanded={expanded}
                aria-controls={panelId}
                aria-disabled={normalizedQuery.length > 0 || undefined}
                ref={(element) => { headersRef.current[originalIndex] = element; }}
                onClick={() => { if (!normalizedQuery) toggle(item.id); }}
                onKeyDown={(event) => onHeaderKeyDown(event, visibleIndex)}
              >
                <span className="visual-accordion-marker" aria-hidden="true" />
                <span className="visual-accordion-heading">
                  <span className="visual-accordion-title">{item.title}</span>
                  {item.summary && <span className="visual-accordion-summary">{item.summary}</span>}
                </span>
                {item.status && (
                  <span className="visual-accordion-status">
                    {t(`visual.accordion.status.${item.status}`)}
                  </span>
                )}
              </button>
            </h4>
            <div
              className="visual-accordion-panel"
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              hidden={!expanded}
            >
              <ContentBlocks blocks={item.blocks} />
            </div>
          </section>
        );
      })}
    </div>
  );
}
