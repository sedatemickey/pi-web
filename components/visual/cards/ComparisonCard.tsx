import type { ComparisonCard } from "@/lib/visual/schema";

export function ComparisonCardView({ card }: { card: ComparisonCard }) {
  return (
    <div className="visual-comparison" style={{ "--visual-comparison-columns": card.items.length } as React.CSSProperties}>
      {card.items.map((item, index) => (
        <section className="visual-comparison-item" key={`${item.title}-${index}`} aria-label={item.title}>
          <div className="visual-comparison-heading">
            <h4>{item.title}</h4>
            {item.badge && <span className="visual-badge">{item.badge}</span>}
          </div>
          {item.summary && <p className="visual-comparison-summary">{item.summary}</p>}
          <ul>
            {item.points.map((point, pointIndex) => <li key={pointIndex}>{point}</li>)}
          </ul>
        </section>
      ))}
    </div>
  );
}
