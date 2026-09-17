"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AreaChartCard, BarChartCard, LineChartCard } from "@/lib/visual/schema";
import { useI18n } from "@/hooks/useI18n";
import {
  ChartDataTable,
  ChartFrame,
  chartAriaLabel,
  chartColor,
  formatChartValue,
  type ChartTableCell,
} from "./chart-utils";

type CartesianCard = BarChartCard | LineChartCard | AreaChartCard;
type CartesianKind = "bar" | "line" | "area";

type ChartDatum = Record<string, string | number | null>;

function seriesKeys(card: CartesianCard): string[] {
  return card.series.map((_, index) => `v${index}`);
}

function buildChartData(card: CartesianCard, keys: readonly string[]): ChartDatum[] {
  return card.labels.map((label, labelIndex) => {
    const datum: ChartDatum = { label };
    card.series.forEach((series, seriesIndex) => {
      datum[keys[seriesIndex]] = series.values[labelIndex] ?? null;
    });
    return datum;
  });
}

function createTooltipFormatter(unit?: string) {
  return (value: number | string | ReadonlyArray<number | string> | undefined) => {
    if (value === undefined) return "-";
    if (Array.isArray(value)) return value.map((entry) => formatChartValue(Number(entry), unit)).join(", ");
    return formatChartValue(typeof value === "number" ? value : Number(value), unit);
  };
}

function CartesianAxes({ card, showLegend }: { card: CartesianCard; showLegend: boolean }) {
  return (
    <>
      <CartesianGrid className="visual-chart-grid" strokeDasharray="3 3" vertical={false} />
      <XAxis
        dataKey="label"
        className="visual-chart-axis"
        tickLine={false}
        height={card.xLabel ? 46 : 30}
        label={card.xLabel ? { value: card.xLabel, position: "insideBottom", offset: -4 } : undefined}
      />
      <YAxis
        className="visual-chart-axis"
        tickLine={false}
        width={card.yLabel ? 66 : 52}
        label={card.yLabel ? { value: card.yLabel, angle: -90, position: "insideLeft" } : undefined}
      />
      <Tooltip formatter={createTooltipFormatter(card.unit)} />
      {showLegend && <Legend itemSorter={null} />}
    </>
  );
}

function CartesianChartView({ card, kind }: { card: CartesianCard; kind: CartesianKind }) {
  const { t } = useI18n();
  const keys = seriesKeys(card);
  const data = buildChartData(card, keys);
  const showLegend = card.showLegend ?? card.series.length > 1;
  const stackId = kind !== "line" && (card as BarChartCard | AreaChartCard).stacked ? "visual-stack" : undefined;
  const height = kind === "line" ? 280 : 260;

  const series = card.series.map((entry, index) => {
    const color = chartColor(index);
    const shared = { dataKey: keys[index], name: entry.label };
    if (kind === "bar") {
      return <Bar {...shared} key={entry.id} fill={color} stackId={stackId} isAnimationActive={false} />;
    }
    if (kind === "line") {
      return <Line {...shared} key={entry.id} stroke={color} strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />;
    }
    return <Area {...shared} key={entry.id} stroke={color} fill={color} fillOpacity={0.18} stackId={stackId} isAnimationActive={false} />;
  });

  const chartMargin = { top: 8, right: 8, bottom: card.xLabel ? 6 : 0, left: card.yLabel ? 6 : 0 };
  const chart = kind === "bar"
    ? <BarChart data={data} margin={chartMargin}><CartesianAxes card={card} showLegend={showLegend} />{series}</BarChart>
    : kind === "line"
      ? <LineChart data={data} margin={chartMargin}><CartesianAxes card={card} showLegend={showLegend} />{series}</LineChart>
      : <AreaChart data={data} margin={chartMargin}><CartesianAxes card={card} showLegend={showLegend} />{series}</AreaChart>;

  const ariaLabel = chartAriaLabel(
    card.title,
    card.xLabel ? `${card.xLabel}` : undefined,
    card.yLabel ? `${card.yLabel}` : undefined,
    card.series.map((entry) => entry.label).join(", "),
  );

  const tableColumns: string[] = [
    card.xLabel ?? t("visual.chart.category"),
    ...card.series.map((entry) => (card.unit ? `${entry.label} (${card.unit})` : entry.label)),
  ];
  const tableRows: ChartTableCell[][] = card.labels.map((label, labelIndex) => [
    label,
    ...card.series.map((entry) => entry.values[labelIndex] ?? null),
  ]);

  return (
    <ChartFrame
      kind={kind}
      ariaLabel={ariaLabel}
      height={height}
      minWidth={Math.max(320, card.labels.length * 52 + 80)}
      chart={chart}
      dataTable={<ChartDataTable caption={card.title} description={card.fallback} columns={tableColumns} rows={tableRows} />}
    />
  );
}

export function BarChartCardView({ card }: { card: BarChartCard }) {
  return <CartesianChartView card={card} kind="bar" />;
}

export function LineChartCardView({ card }: { card: LineChartCard }) {
  return <CartesianChartView card={card} kind="line" />;
}

export function AreaChartCardView({ card }: { card: AreaChartCard }) {
  return <CartesianChartView card={card} kind="area" />;
}