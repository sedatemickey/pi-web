"use client";

import type { CalloutCard } from "@/lib/visual/schema";
import { useToneLabel } from "./statusTone";

export function CalloutCardView({ card }: { card: CalloutCard }) {
  const toneLabel = useToneLabel(card.tone);

  return (
    <div className="visual-callout" data-tone={card.tone} role="note">
      <span className="visual-callout-marker" aria-hidden="true" />
      <div className="visual-callout-main">
        <div className="visual-callout-heading">
          <span className="visual-callout-tone">{toneLabel}</span>
        </div>
        <p className="visual-callout-text">{card.text}</p>
        {card.points && (
          <ul className="visual-callout-points">
            {card.points.map((point, index) => <li key={index}>{point}</li>)}
          </ul>
        )}
      </div>
    </div>
  );
}