import type { KeyValueCard } from "@/lib/visual/schema";

export function KeyValueCardView({ card }: { card: KeyValueCard }) {
  return (
    <dl className="visual-key-value" data-count={card.items.length}>
      {card.items.map((item, index) => (
        <div className="visual-key-value-row" data-style={item.style ?? "text"} key={`${item.label}-${index}`}>
          <dt className="visual-key-value-label">{item.label}</dt>
          <dd className="visual-key-value-value">
            {item.style === "code"
              ? <code className="visual-key-value-code">{item.value}</code>
              : item.value}
            {item.description && <span className="visual-key-value-description">{item.description}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}