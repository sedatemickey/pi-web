import type { ReactNode } from "react";
import type {
  AccordionCard,
  AreaChartCard,
  BarChartCard,
  CalloutCard,
  ChecklistCard,
  ComparisonCard,
  DataTableCard,
  DonutChartCard,
  HeatmapCard,
  KeyValueCard,
  LineChartCard,
  MetricsCard,
  ProgressCard,
  SparklineCard,
  StatusCard,
  StepsCard,
  TabsCard,
  VisualCard,
  VisualCardType,
} from "@/lib/visual/schema";
import { AccordionCardView } from "./cards/AccordionCard";
import { CalloutCardView } from "./cards/CalloutCard";
import { AreaChartCardView, BarChartCardView, LineChartCardView } from "./cards/CartesianChartCard";
import { DonutChartCardView, HeatmapCardView, SparklineCardView } from "./cards/ChartCards";
import { ChecklistCardView } from "./cards/ChecklistCard";
import { ComparisonCardView } from "./cards/ComparisonCard";
import { DataTableCardView } from "./cards/DataTableCard";
import { KeyValueCardView } from "./cards/KeyValueCard";
import { MetricsCardView } from "./cards/MetricsCard";
import { ProgressCardView } from "./cards/ProgressCard";
import { StatusCardView } from "./cards/StatusCard";
import { StepsCardView } from "./cards/StepsCard";
import { TabsCardView } from "./cards/TabsCard";

const CARD_RENDERERS = {
  metrics: (card: MetricsCard) => <MetricsCardView card={card} />,
  comparison: (card: ComparisonCard) => <ComparisonCardView card={card} />,
  steps: (card: StepsCard) => <StepsCardView card={card} />,
  tabs: (card: TabsCard) => <TabsCardView card={card} />,
  accordion: (card: AccordionCard) => <AccordionCardView card={card} />,
  "data-table": (card: DataTableCard) => <DataTableCardView card={card} />,
  "bar-chart": (card: BarChartCard) => <BarChartCardView card={card} />,
  "line-chart": (card: LineChartCard) => <LineChartCardView card={card} />,
  "area-chart": (card: AreaChartCard) => <AreaChartCardView card={card} />,
  "donut-chart": (card: DonutChartCard) => <DonutChartCardView card={card} />,
  sparkline: (card: SparklineCard) => <SparklineCardView card={card} />,
  heatmap: (card: HeatmapCard) => <HeatmapCardView card={card} />,
  status: (card: StatusCard) => <StatusCardView card={card} />,
  "key-value": (card: KeyValueCard) => <KeyValueCardView card={card} />,
  progress: (card: ProgressCard) => <ProgressCardView card={card} />,
  checklist: (card: ChecklistCard) => <ChecklistCardView card={card} />,
  callout: (card: CalloutCard) => <CalloutCardView card={card} />,
} satisfies { [Type in VisualCardType]: (card: Extract<VisualCard, { type: Type }>) => ReactNode };

export function CardRenderer({ card }: { card: VisualCard }) {
  switch (card.type) {
    case "metrics":
      return CARD_RENDERERS.metrics(card);
    case "comparison":
      return CARD_RENDERERS.comparison(card);
    case "steps":
      return CARD_RENDERERS.steps(card);
    case "tabs":
      return CARD_RENDERERS.tabs(card);
    case "accordion":
      return CARD_RENDERERS.accordion(card);
    case "data-table":
      return CARD_RENDERERS["data-table"](card);
    case "bar-chart":
      return CARD_RENDERERS["bar-chart"](card);
    case "line-chart":
      return CARD_RENDERERS["line-chart"](card);
    case "area-chart":
      return CARD_RENDERERS["area-chart"](card);
    case "donut-chart":
      return CARD_RENDERERS["donut-chart"](card);
    case "sparkline":
      return CARD_RENDERERS.sparkline(card);
    case "heatmap":
      return CARD_RENDERERS.heatmap(card);
    case "status":
      return CARD_RENDERERS.status(card);
    case "key-value":
      return CARD_RENDERERS["key-value"](card);
    case "progress":
      return CARD_RENDERERS.progress(card);
    case "checklist":
      return CARD_RENDERERS.checklist(card);
    case "callout":
      return CARD_RENDERERS.callout(card);
  }
}
