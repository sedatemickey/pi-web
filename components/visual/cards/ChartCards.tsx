"use client";

import { Cell, Legend, Line, LineChart, Pie, PieChart, Tooltip, YAxis } from "recharts";
import { useI18n } from "@/hooks/useI18n";
import type { DonutChartCard, HeatmapCard, SparklineCard } from "@/lib/visual/schema";
import {
  ChartDataTable,
  ChartFrame,
  chartAriaLabel,
  chartColor,
  formatChartNumber,
  formatChartValue,
  type ChartTableCell,
} from "./chart-utils";

function chartTooltipFormatter(unit?: string) {
  return (value: number | string | ReadonlyArray<number | string> | undefined) => {
    if (value === undefined) return "-";
    if (Array.isArray(value)) return value.map((entry) => formatChartValue(Number(entry), unit)).join(", ");
    return formatChartValue(typeof value === "number" ? value : Number(value), unit);
  };
}

export function DonutChartCardView({ card }: { card: DonutChartCard }) {
  const { t } = useI18n();
  const chart = (
    <PieChart>
      <Tooltip formatter={chartTooltipFormatter(card.unit)} />
      <Legend itemSorter={null} />
      <Pie
        data={card.items}
        dataKey="value"
        nameKey="label"
        innerRadius="58%"
        outerRadius="82%"
        paddingAngle={2}
        stroke="none"
        isAnimationActive={false}
      >
        {card.items.map((item, index) => (
          <Cell key={`${item.label}-${index}`} fill={chartColor(index)} />
        ))}
      </Pie>
    </PieChart>
  );

  const overlay = card.centerValue || card.centerLabel ? (
    <div className="visual-donut-center">
      {card.centerValue && <span className="visual-donut-center-value">{card.centerValue}</span>}
      {card.centerLabel && <span className="visual-donut-center-label">{card.centerLabel}</span>}
    </div>
  ) : undefined;

  const rows: ChartTableCell[][] = card.items.map((item) => [item.label, item.value]);

  return (
    <ChartFrame
      kind="donut"
      ariaLabel={chartAriaLabel(
        card.title,
        card.centerLabel,
        card.centerValue,
        card.items.map((item) => item.label).join(", "),
      )}
      height={260}
      chart={chart}
      overlay={overlay}
      dataTable={
        <ChartDataTable
          caption={card.title}
          description={chartAriaLabel(card.fallback, card.centerLabel, card.centerValue)}
          columns={[
            t("visual.chart.category"),
            card.unit ? `${t("visual.chart.value")} (${card.unit})` : t("visual.chart.value"),
          ]}
          rows={rows}
        />
      }
    />
  );
}

export function SparklineCardView({ card }: { card: SparklineCard }) {
  const { t } = useI18n();
  const data = card.data.map((value, index) => ({ label: String(index + 1), value }));
  const chart = (
    <LineChart data={data}>
      <YAxis hide domain={["dataMin - 1", "dataMax + 1"]} />
      <Line dataKey="value" stroke={chartColor(0)} strokeWidth={2} dot={false} isAnimationActive={false} />
    </LineChart>
  );

  const rows: ChartTableCell[][] = card.data.map((value, index) => [String(index + 1), value]);

  return (
    <div className="visual-sparkline">
      {(card.value || card.detail || card.trend) && (
        <div className="visual-sparkline-summary">
          {card.value && <span className="visual-sparkline-value">{card.value}</span>}
          {card.trend && (
            <span className="visual-trend" data-direction={card.trend.direction}>
              <span className="visual-trend-mark" aria-hidden="true" />
              {card.trend.label}
            </span>
          )}
          {card.detail && <span className="visual-sparkline-detail">{card.detail}</span>}
        </div>
      )}
      <ChartFrame
        kind="sparkline"
        ariaLabel={chartAriaLabel(card.title, card.value, card.trend?.label)}
        height={56}
        chart={chart}
        dataTable={
          <ChartDataTable
            caption={card.title}
            description={card.fallback}
            columns={[t("visual.chart.point"), t("visual.chart.value")]}
            rows={rows}
          />
        }
      />
    </div>
  );
}

const HEATMAP_INTENSITY_BUCKETS = 5;

function heatmapIntensity(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  if (max <= min) return 0;
  const ratio = (value - min) / (max - min);
  return Math.min(HEATMAP_INTENSITY_BUCKETS - 1, Math.max(0, Math.floor(ratio * HEATMAP_INTENSITY_BUCKETS)));
}

export function HeatmapCardView({ card }: { card: HeatmapCard }) {
  const { t } = useI18n();
  const numericValues = card.rows.flatMap((row) =>
    row.values.filter((value): value is number => value !== null && Number.isFinite(value)),
  );
  const min = numericValues.length ? Math.min(...numericValues) : 0;
  const max = numericValues.length ? Math.max(...numericValues) : 0;

  const tableRows: ChartTableCell[][] = card.rows.map((row) => [row.label, ...row.values]);

  return (
    <figure className="visual-chart" data-chart-kind="heatmap">
      <div className="visual-heatmap-wrap">
        <table className="visual-heatmap" aria-hidden="true">
          <caption className="visual-chart-sr-only">{card.title}</caption>
          <thead>
            <tr>
              <th className="visual-heatmap-corner" scope="col" />
              {card.columns.map((column, columnIndex) => (
                <th scope="col" key={columnIndex}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {card.rows.map((row, rowIndex) => (
              <tr key={`${row.label}-${rowIndex}`}>
                <th scope="row">{row.label}</th>
                {card.columns.map((column, columnIndex) => {
                  const value = row.values[columnIndex] ?? null;
                  const intensity = value === null ? null : heatmapIntensity(value, min, max);
                  return (
                    <td
                      key={columnIndex}
                      data-intensity={intensity === null ? "none" : String(intensity)}
                      title={`${row.label} / ${column}: ${formatChartValue(value, card.unit)}`}
                    >
                      <span className="visual-heatmap-value">{value === null ? "-" : formatChartNumber(value)}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(card.lowLabel || card.highLabel) && (
        <div className="visual-heatmap-scale" aria-hidden="true">
          <span className="visual-heatmap-scale-label">{card.lowLabel}</span>
          <span className="visual-heatmap-scale-swatches">
            {Array.from({ length: HEATMAP_INTENSITY_BUCKETS }, (_, bucket) => (
              <span className="visual-heatmap-swatch" data-intensity={String(bucket)} key={bucket} />
            ))}
          </span>
          <span className="visual-heatmap-scale-label">{card.highLabel}</span>
        </div>
      )}
      <ChartDataTable
        caption={card.title}
        description={chartAriaLabel(card.fallback, card.lowLabel, card.highLabel, card.unit)}
        columns={[
          t("visual.chart.category"),
          ...card.columns.map((column) => card.unit ? `${column} (${card.unit})` : column),
        ]}
        rows={tableRows}
      />
    </figure>
  );
}
