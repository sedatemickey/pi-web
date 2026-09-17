"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/hooks/useI18n";
import { copyText } from "@/lib/clipboard";
import {
  dataTableCellText,
  dataTableStatusOptions,
  deriveDataTableRows,
  serializeDataTableCsv,
  serializeDataTableTsv,
  type DataTableSort,
  type DataTableStatusFilters,
} from "@/lib/visual/data-table";
import { DATA_TABLE_PAGE_SIZE, type DataTableCard, type DataTableCell, type DataTableColumn } from "@/lib/visual/schema";

function nextSort(current: DataTableSort, columnId: string): DataTableSort {
  if (!current || current.columnId !== columnId) return { columnId, direction: "ascending" };
  if (current.direction === "ascending") return { columnId, direction: "descending" };
  return null;
}

function downloadCsv(card: DataTableCard, csv: string): void {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${card.id}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function DataTableCellView({ column, value }: { column: DataTableColumn; value: DataTableCell }) {
  const { t } = useI18n();
  if (value === null) return <span className="visual-table-null">-</span>;
  if (column.dataType === "status") {
    return (
      <span className="visual-table-status" data-status={String(value)}>
        {t(`visual.table.status.${String(value)}`)}
      </span>
    );
  }
  if (column.dataType === "code") return <code className="visual-table-code">{String(value)}</code>;
  return <>{dataTableCellText(value)}</>;
}

export function DataTableCardView({ card }: { card: DataTableCard }) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [statusFilters, setStatusFilters] = useState<DataTableStatusFilters>({});
  const [sort, setSort] = useState<DataTableSort>(null);
  const [page, setPage] = useState(0);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const statusColumns = card.columns.filter((column) => column.dataType === "status");
  const derivedRows = useMemo(
    () => deriveDataTableRows(card, query, statusFilters, sort),
    [card, query, sort, statusFilters],
  );
  const pageCount = Math.max(1, Math.ceil(derivedRows.length / DATA_TABLE_PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageStart = safePage * DATA_TABLE_PAGE_SIZE;
  const pageRows = derivedRows.slice(pageStart, pageStart + DATA_TABLE_PAGE_SIZE);

  const resetPage = () => setPage(0);
  const updateStatusFilter = (columnId: string, value: string) => {
    setStatusFilters((current) => ({ ...current, [columnId]: value }));
    resetPage();
  };

  const copyRows = () => {
    copyText(serializeDataTableTsv(card, derivedRows))
      .then(() => {
        setCopyState("copied");
        setTimeout(() => setCopyState("idle"), 1500);
      })
      .catch(() => {
        setCopyState("failed");
        setTimeout(() => setCopyState("idle"), 2000);
      });
  };

  const resultStart = derivedRows.length === 0 ? 0 : pageStart + 1;
  const resultEnd = Math.min(pageStart + DATA_TABLE_PAGE_SIZE, derivedRows.length);

  return (
    <div className="visual-data-table">
      <div className="visual-table-toolbar">
        <input
          type="search"
          className="visual-control-input visual-table-search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            resetPage();
          }}
          placeholder={t("visual.table.search")}
          aria-label={t("visual.table.search")}
        />
        {statusColumns.map((column) => (
          <label className="visual-table-filter" key={column.id}>
            <span>{column.label}</span>
            <select
              value={statusFilters[column.id] ?? ""}
              onChange={(event) => updateStatusFilter(column.id, event.target.value)}
              aria-label={t("visual.table.filterBy", { column: column.label })}
            >
              <option value="">{t("visual.table.allStatuses")}</option>
              {dataTableStatusOptions(card, column.id).map((status) => (
                <option value={status} key={status}>{t(`visual.table.status.${status}`)}</option>
              ))}
            </select>
          </label>
        ))}
        <div className="visual-table-actions">
          <button type="button" className="visual-control-button" onClick={copyRows}>
            {copyState === "copied" ? t("visual.table.copied") : t("visual.table.copy")}
          </button>
          <button
            type="button"
            className="visual-control-button"
            onClick={() => downloadCsv(card, serializeDataTableCsv(card, derivedRows))}
          >
            {t("visual.table.downloadCsv")}
          </button>
        </div>
        <span className="visual-table-live" aria-live="polite">
          {copyState === "failed" ? t("visual.table.copyFailed") : ""}
        </span>
      </div>

      <div className="visual-data-table-wrap">
        <table>
          <thead>
            <tr>
              {card.columns.map((column) => {
                const activeSort = sort?.columnId === column.id ? sort.direction : "none";
                return (
                  <th
                    scope="col"
                    aria-sort={activeSort}
                    data-align={column.align ?? (column.dataType === "number" ? "end" : "start")}
                    key={column.id}
                  >
                    <button
                      type="button"
                      className="visual-table-sort"
                      onClick={() => {
                        setSort((current) => nextSort(current, column.id));
                        resetPage();
                      }}
                    >
                      <span>{column.label}</span>
                      <span className="visual-table-sort-mark" data-direction={activeSort} aria-hidden="true" />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pageRows.map(({ row, sourceIndex }) => (
              <tr key={sourceIndex}>
                {card.columns.map((column) => (
                  <td
                    data-align={column.align ?? (column.dataType === "number" ? "end" : "start")}
                    key={column.id}
                  >
                    <DataTableCellView column={column} value={row[column.id] ?? null} />
                  </td>
                ))}
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr><td className="visual-table-empty" colSpan={card.columns.length}>{t("visual.table.noMatches")}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="visual-table-footer">
        <span>
          {t("visual.table.range", {
            start: String(resultStart),
            end: String(resultEnd),
            total: String(derivedRows.length),
          })}
        </span>
        {pageCount > 1 && (
          <div className="visual-table-pagination" aria-label={t("visual.table.pagination")}>
            <button
              type="button"
              className="visual-control-button"
              onClick={() => setPage((current) => Math.max(0, current - 1))}
              disabled={safePage === 0}
            >
              {t("visual.table.previous")}
            </button>
            <span>{t("visual.table.page", { page: String(safePage + 1), pages: String(pageCount) })}</span>
            <button
              type="button"
              className="visual-control-button"
              onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
              disabled={safePage >= pageCount - 1}
            >
              {t("visual.table.next")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
