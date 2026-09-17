"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import type { TabsCard } from "@/lib/visual/schema";
import { ContentBlocks } from "../ContentBlocks";

export function TabsCardView({ card }: { card: TabsCard }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const tabsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const instanceId = useId().replaceAll(":", "");
  const selectedIndex = Math.min(activeIndex, card.items.length - 1);

  const activateAndFocus = (index: number) => {
    setActiveIndex(index);
    tabsRef.current[index]?.focus();
    tabsRef.current[index]?.scrollIntoView({ block: "nearest", inline: "nearest" });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % card.items.length;
    else if (event.key === "ArrowLeft") nextIndex = (index - 1 + card.items.length) % card.items.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = card.items.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    activateAndFocus(nextIndex);
  };

  return (
    <div className="visual-tabs">
      <div className="visual-tab-list" role="tablist" aria-label={card.title}>
        {card.items.map((item, index) => {
          const selected = index === selectedIndex;
          const tabId = `visual-tab-${instanceId}-${item.id}`;
          const panelId = `visual-panel-${instanceId}-${item.id}`;
          return (
            <button
              type="button"
              className="visual-tab"
              role="tab"
              id={tabId}
              aria-controls={panelId}
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              key={item.id}
              ref={(element) => { tabsRef.current[index] = element; }}
              onClick={() => setActiveIndex(index)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              <span>{item.label}</span>
              {item.badge && <span className="visual-badge">{item.badge}</span>}
            </button>
          );
        })}
      </div>
      {card.items.map((item, index) => {
        const tabId = `visual-tab-${instanceId}-${item.id}`;
        const panelId = `visual-panel-${instanceId}-${item.id}`;
        return (
          <div
            className="visual-tab-panel"
            role="tabpanel"
            id={panelId}
            aria-labelledby={tabId}
            tabIndex={0}
            hidden={index !== selectedIndex}
            key={item.id}
          >
            <ContentBlocks blocks={item.blocks} />
          </div>
        );
      })}
    </div>
  );
}
