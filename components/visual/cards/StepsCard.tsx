import { useI18n } from "@/hooks/useI18n";
import type { StepsCard } from "@/lib/visual/schema";

export function StepsCardView({ card }: { card: StepsCard }) {
  const { t } = useI18n();

  return (
    <ol className="visual-steps">
      {card.items.map((item, index) => (
        <li className="visual-step" data-status={item.status ?? "pending"} key={`${item.title}-${index}`}>
          <div className="visual-step-marker" aria-hidden="true">{index + 1}</div>
          <div className="visual-step-content">
            <div className="visual-step-heading">
              <h4>{item.title}</h4>
              {item.status && <span className="visual-step-status">{t(`visual.status.${item.status}`)}</span>}
            </div>
            {item.description && <p>{item.description}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
