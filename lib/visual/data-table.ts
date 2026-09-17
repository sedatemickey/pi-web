import type { DataTableCard, DataTableCell, DataTableColumn } from "./schema";

export type DataTableRow = DataTableCard["rows"][number];
export type DataTableSort = { columnId: string; direction: "ascending" | "descending" } | null;
export type DataTableStatusFilters = Record<string, string>;

export interface IndexedDataTableRow {
  row: DataTableRow;
  sourceIndex: number;
}

export function dataTableCellText(value: DataTableCell): string {
  return value === null ? "" : String(value);
}

function compareValues(column: DataTableColumn, left: DataTableCell, right: DataTableCell): number {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;

  if (column.dataType === "number") return Number(left) - Number(right);
  if (column.dataType === "date") return Date.parse(String(left)) - Date.parse(String(right));
  return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: "base" });
}

export function deriveDataTableRows(
  card: DataTableCard,
  query: string,
  statusFilters: DataTableStatusFilters,
  sort: DataTableSort,
): IndexedDataTableRow[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filtered = card.rows
    .map((row, sourceIndex) => ({ row, sourceIndex }))
    .filter(({ row }) => {
      if (
        normalizedQuery
        && !card.columns.some((column) => dataTableCellText(row[column.id] ?? null).toLocaleLowerCase().includes(normalizedQuery))
      ) {
        return false;
      }
      return Object.entries(statusFilters).every(([columnId, expected]) => (
        !expected || row[columnId] === expected
      ));
    });

  if (!sort) return filtered;
  const column = card.columns.find((candidate) => candidate.id === sort.columnId);
  if (!column) return filtered;
  const direction = sort.direction === "ascending" ? 1 : -1;

  return [...filtered].sort((left, right) => {
    const leftValue = left.row[column.id] ?? null;
    const rightValue = right.row[column.id] ?? null;
    if (leftValue === null || rightValue === null) {
      if (leftValue === null && rightValue === null) return left.sourceIndex - right.sourceIndex;
      return leftValue === null ? 1 : -1;
    }
    const compared = compareValues(column, leftValue, rightValue);
    return compared === 0 ? left.sourceIndex - right.sourceIndex : compared * direction;
  });
}

export function neutralizeSpreadsheetFormula(value: string): string {
  return value.replace(/^(\s*)([=+\-@])/, "$1'$2");
}

function csvCell(value: string | number | null): string {
  const text = value === null ? "" : String(value);
  const safe = typeof value === "string" ? neutralizeSpreadsheetFormula(text) : text;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

function tsvCell(value: string | number | null): string {
  const text = value === null ? "" : String(value);
  const safe = typeof value === "string" ? neutralizeSpreadsheetFormula(text) : text;
  return safe.replace(/[\t\r\n]+/g, " ");
}

export function serializeDataTableCsv(card: DataTableCard, rows: readonly IndexedDataTableRow[]): string {
  const records: Array<Array<string | number | null>> = [
    card.columns.map((column) => column.label),
    ...rows.map(({ row }) => card.columns.map((column) => row[column.id] ?? null)),
  ];
  return `\uFEFF${records.map((record) => record.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

export function serializeDataTableTsv(card: DataTableCard, rows: readonly IndexedDataTableRow[]): string {
  const records: Array<Array<string | number | null>> = [
    card.columns.map((column) => column.label),
    ...rows.map(({ row }) => card.columns.map((column) => row[column.id] ?? null)),
  ];
  return records.map((record) => record.map(tsvCell).join("\t")).join("\n");
}

export function dataTableStatusOptions(card: DataTableCard, columnId: string): string[] {
  return [...new Set(card.rows.map((row) => row[columnId]).filter((value): value is string => typeof value === "string"))]
    .sort((left, right) => left.localeCompare(right));
}
