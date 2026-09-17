"use client";

import type { StatusCard } from "@/lib/visual/schema";
import { useToneLabel } from "./statusTone";

export function StatusCardView({ card }: { card: StatusCard }) {
  const toneLabel = useToneLabel(card.status);

  return (
    <div className="visual-status" data-status={card.status}>
      <span className="visual-status-marker" aria-hidden="true" />
      <div className="visual-status-main">
        <div className="visual-status-heading">
          <p className="visual-status-label">{card.label}</p>
          <span className="visual-status-tone">{toneLabel}</span>
        </div>
        {card.description && <p className="visual-status-description">{card.description}</p>}
        {card.detail && <p className="visual-status-detail">{card.detail}</p>}
      </div>
    </div>
  );
}