"use client";

import { useId } from "react";
import type { ProgressCard } from "@/lib/visual/schema";
import { useToneLabel } from "./statusTone";

type ProgressItem = ProgressCard["items"][number];

function formatProgressValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function ProgressItemView({ item, labelId }: { item: ProgressItem; labelId: string }) {
  const status = item.status ?? "neutral";
  const toneLabel = useToneLabel(status);

  return (
    <li className="visual-progress-item" data-status={status}>
      <div className="visual-progress-heading">
        <span className="visual-progress-label" id={labelId}>{item.label}</span>
        {item.status && <span className="visual-progress-status">{toneLabel}</span>}
        <span className="visual-progress-value">{formatProgressValue(item.value)}%</span>
      </div>
      <progress className="visual-progress-meter" value={item.value} max={100} aria-labelledby={labelId} />
      {item.detail && <p className="visual-progress-detail">{item.detail}</p>}
    </li>
  );
}

export function ProgressCardView({ card }: { card: ProgressCard }) {
  const instanceId = useId().replaceAll(":", "");

  return (
    <ul className="visual-progress">
      {card.items.map((item, index) => (
        <ProgressItemView item={item} labelId={`visual-progress-label-${instanceId}-${index}`} key={`${item.label}-${index}`} />
      ))}
    </ul>
  );
}