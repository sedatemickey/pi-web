import type { MetricsCard } from "@/lib/visual/schema";

export function MetricsCardView({ card }: { card: MetricsCard }) {
  const desktopColumns = card.items.length === 6 ? 3 : card.items.length;

  return (
    <dl
      className="visual-metrics"
      data-count={card.items.length}
      style={{ "--visual-metric-columns": desktopColumns } as React.CSSProperties}
    >
      {card.items.map((item, index) => (
        <div className="visual-metric" key={`${item.label}-${index}`}>
          <dt>{item.label}</dt>
          <dd className="visual-metric-value">{item.value}</dd>
          {(item.detail || item.trend) && (
            <dd className="visual-metric-detail">
              {item.detail && <span>{item.detail}</span>}
              {item.trend && (
                <span className="visual-trend" data-direction={item.trend.direction}>
                  <span className="visual-trend-mark" aria-hidden="true" />
                  {item.trend.label}
                </span>
              )}
            </dd>
          )}
        </div>
      ))}
    </dl>
  );
}
