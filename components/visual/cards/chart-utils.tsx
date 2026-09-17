"use client";

import type { CSSProperties, ReactElement, ReactNode } from "react";
import { ResponsiveContainer } from "recharts";

/**
 * Fixed, trusted categorical palette.
 *
 * The model can never provide colors, so every chart maps its series index onto
 * this constant list. Each entry uses a CSS custom property with a safe fallback
 * so a future theme can tune the palette without changing the protocol.
 */
const VISUAL_CHART_PALETTE = [
  "var(--visual-chart-1, #2563eb)",
  "var(--visual-chart-2, #0d9488)",
  "var(--visual-chart-3, #7c3aed)",
  "var(--visual-chart-4, #d97706)",
  "var(--visual-chart-5, #db2777)",
  "var(--visual-chart-6, #0284c7)",
  "var(--visual-chart-7, #65a30d)",
  "var(--visual-chart-8, #dc2626)",
] as const;

/** Map any non-negative chart index onto the fixed palette. */
export function chartColor(index: number): string {
  const length = VISUAL_CHART_PALETTE.length;
  const normalized = ((Math.trunc(index) % length) + length) % length;
  return VISUAL_CHART_PALETTE[normalized];
}

const numberFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 });

/** Deterministic numeric text so server and client render identically. */
export function formatChartNumber(value: number): string {
  if (!Number.isFinite(value)) return "-";
  return numberFormatter.format(value);
}

/** Format a nullable numeric value, optionally suffixed with the card unit. */
export function formatChartValue(value: number | null | undefined, unit?: string): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  const formatted = formatChartNumber(value);
  return unit ? `${formatted} ${unit}` : formatted;
}

export type ChartTableCell = string | number | null;

export function chartTableCellText(value: ChartTableCell): string {
  if (value === null) return "";
  return typeof value === "number" ? formatChartNumber(value) : value;
}

interface ChartDataTableProps {
  caption: string;
  description?: string;
  columns: readonly string[];
  rows: readonly (readonly ChartTableCell[])[];
}

/**
 * Complete visually-hidden data table giving assistive technology the full set
 * of source values, independent of any local chart interaction state.
 */
export function ChartDataTable({ caption, description, columns, rows }: ChartDataTableProps) {
  return (
    <div className="visual-chart-sr">
      {description && <p className="visual-chart-sr-description">{description}</p>}
      <table className="visual-chart-sr-table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            {columns.map((column, index) => (
              <th scope="col" key={index}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {columns.map((_, columnIndex) => columnIndex === 0
                ? <th scope="row" key={columnIndex}>{chartTableCellText(row[columnIndex] ?? null)}</th>
                : <td key={columnIndex}>{chartTableCellText(row[columnIndex] ?? null)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface ChartFrameProps {
  kind: string;
  ariaLabel: string;
  height: number;
  minWidth?: number;
  chart: ReactElement;
  overlay?: ReactNode;
  dataTable: ReactNode;
}

/**
 * Shared figure frame: exposes a labelled static image to assistive technology
 * and keeps the responsive canvas on a stable minimum height.
 */
export function ChartFrame({ kind, ariaLabel, height, minWidth, chart, overlay, dataTable }: ChartFrameProps) {
  const canvasStyle = minWidth ? { minWidth } satisfies CSSProperties : undefined;
  return (
    <figure className="visual-chart" data-chart-kind={kind}>
      <div className="visual-chart-figure" role="img" aria-label={ariaLabel}>
        <div className="visual-chart-inner" style={canvasStyle}>
          <ResponsiveContainer
            width="100%"
            height={height}
            minHeight={height}
            className="visual-chart-canvas"
          >
            {chart}
          </ResponsiveContainer>
          {overlay && <div className="visual-chart-overlay" aria-hidden="true">{overlay}</div>}
        </div>
      </div>
      {dataTable}
    </figure>
  );
}

/** Build a bounded, plain-text label from card-provided fragments. */
export function chartAriaLabel(...parts: Array<string | undefined>): string {
  return parts.filter((part): part is string => Boolean(part && part.trim())).join(". ");
}
