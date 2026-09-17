"use client";

import { useI18n } from "@/hooks/useI18n";
import type { ChecklistCard } from "@/lib/visual/schema";

const CHECKLIST_STATUS_KEYS = {
  complete: "visual.status.complete",
  current: "visual.status.current",
  pending: "visual.status.pending",
} as const;

export function ChecklistCardView({ card }: { card: ChecklistCard }) {
  const { t } = useI18n();

  return (
    <ul className="visual-checklist" data-count={card.items.length}>
      {card.items.map((item, index) => (
        <li className="visual-checklist-item" data-status={item.status} key={`${item.label}-${index}`}>
          <span className="visual-checklist-marker" aria-hidden="true" />
          <div className="visual-checklist-content">
            <div className="visual-checklist-heading">
              <span className="visual-checklist-label">{item.label}</span>
              <span className="visual-checklist-status">{t(CHECKLIST_STATUS_KEYS[item.status])}</span>
            </div>
            {item.description && <p className="visual-checklist-description">{item.description}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}