import type { ReactNode } from "react";
import type {
  ComparisonCard,
  MetricsCard,
  StepsCard,
  VisualCard,
  VisualCardType,
} from "@/lib/visual/schema";
import { ComparisonCardView } from "./cards/ComparisonCard";
import { MetricsCardView } from "./cards/MetricsCard";
import { StepsCardView } from "./cards/StepsCard";

const CARD_RENDERERS = {
  metrics: (card: MetricsCard) => <MetricsCardView card={card} />,
  comparison: (card: ComparisonCard) => <ComparisonCardView card={card} />,
  steps: (card: StepsCard) => <StepsCardView card={card} />,
} satisfies { [Type in VisualCardType]: (card: Extract<VisualCard, { type: Type }>) => ReactNode };

export function CardRenderer({ card }: { card: VisualCard }) {
  switch (card.type) {
    case "metrics":
      return CARD_RENDERERS.metrics(card);
    case "comparison":
      return CARD_RENDERERS.comparison(card);
    case "steps":
      return CARD_RENDERERS.steps(card);
  }
}
