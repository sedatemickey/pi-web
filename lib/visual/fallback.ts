import type { DataTableCell, VisualCard, VisualContentBlock } from "./schema";

function inlineMarkdown(value: string): string {
  return value.replace(/[\\`*_[\]<>|]/g, "\\$&").replace(/\r?\n/g, " ");
}

function plainMarkdown(value: string): string {
  return value.split(/\r?\n/).map((line) => {
    const safe = inlineMarkdown(line);
    if (/^( {4}|\t)/.test(safe)) return `&#32;${safe}`;
    if (/^ {0,3}#{1,6}(?:\s|$)/.test(safe)) return safe.replace("#", "\\#");
    if (/^ {0,3}[-+](?:\s|$)/.test(safe)) return safe.replace(/^((?: {0,3}))([-+])/, "$1\\$2");
    if (/^ {0,3}\d+[.)](?:\s|$)/.test(safe)) return safe.replace(/^((?: {0,3})\d+)([.)])/, "$1\\$2");
    if (/^ {0,3}(?:-+|=+)\s*$/.test(safe)) return safe.replace(/^((?: {0,3}))([-=])/, "$1\\$2");
    if (/^ {0,3}~{3,}/.test(safe)) return safe.replace(/^((?: {0,3}))(~)/, "$1\\$2");
    return safe;
  }).join("\n");
}

function heading(value: string): string {
  return `### ${inlineMarkdown(value)}`;
}

function markdownTable(columns: readonly string[], rows: readonly (readonly string[])[]): string {
  return [
    `| ${columns.map(inlineMarkdown).join(" | ")} |`,
    `| ${columns.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(inlineMarkdown).join(" | ")} |`),
  ].join("\n");
}

function fencedCode(code: string, language?: string): string {
  const longestRun = Math.max(0, ...Array.from(code.matchAll(/`+/g), (match) => match[0].length));
  const fence = "`".repeat(Math.max(3, longestRun + 1));
  return `${fence}${language ?? ""}\n${code}\n${fence}`;
}

function contentBlockToMarkdown(block: VisualContentBlock): string {
  switch (block.type) {
    case "text":
      return plainMarkdown(block.text);
    case "list": {
      const numbered = block.style === "numbered";
      return block.items.map((item, index) => `${numbered ? `${index + 1}.` : "-"} ${inlineMarkdown(item)}`).join("\n");
    }
    case "key-value":
      return markdownTable(
        ["Property", "Value"],
        block.items.map((item) => [item.label, item.value]),
      );
    case "code":
      return fencedCode(block.code, block.language);
    case "table":
      return markdownTable(block.columns, block.rows);
  }
}

function contentBlocksToMarkdown(blocks: readonly VisualContentBlock[]): string {
  return blocks.map(contentBlockToMarkdown).join("\n\n");
}

function cellToMarkdown(value: DataTableCell): string {
  return value === null ? "" : String(value);
}

function chartValue(value: number | null): string {
  return value === null ? "" : String(value);
}

function metaLine(parts: readonly string[]): string[] {
  const present = parts.filter((part) => part !== "");
  return present.length > 0 ? ["", present.map(inlineMarkdown).join(" · ")] : [];
}

type CartesianChartCard = Extract<VisualCard, { type: "bar-chart" | "line-chart" | "area-chart" }>;

function cartesianChartToMarkdown(card: CartesianChartCard): string {
  const columns = [card.xLabel ?? "Label", ...card.series.map((series) => series.label)];
  const rows = card.labels.map((label, index) => [
    label,
    ...card.series.map((series) => chartValue(series.values[index] ?? null)),
  ]);
  const stacked = (card.type === "bar-chart" || card.type === "area-chart") && card.stacked === true;
  return [
    heading(card.title),
    ...metaLine([
      card.xLabel ? `X axis: ${card.xLabel}` : "",
      card.yLabel ? `Y axis: ${card.yLabel}` : "",
      card.unit ? `Unit: ${card.unit}` : "",
      stacked ? "Stacked" : "",
    ]),
    "",
    markdownTable(columns, rows),
  ].join("\n");
}

export function visualCardToMarkdown(card: VisualCard): string {
  switch (card.type) {
    case "metrics": {
      const rows = card.items.map((item) => {
        const detail = [item.detail, item.trend?.label].filter(Boolean).join("; ");
        return [item.label, item.value, detail];
      });
      return [heading(card.title), "", markdownTable(["Metric", "Value", "Detail"], rows)].join("\n");
    }
    case "comparison": {
      const sections = card.items.map((item) => [
        `#### ${inlineMarkdown(item.title)}${item.badge ? ` (${inlineMarkdown(item.badge)})` : ""}`,
        ...(item.summary ? ["", plainMarkdown(item.summary)] : []),
        "",
        ...item.points.map((point) => `- ${inlineMarkdown(point)}`),
      ].join("\n"));
      return [heading(card.title), "", ...sections].join("\n\n");
    }
    case "steps": {
      const steps = card.items.map((item, index) => {
        const status = item.status ? ` [${item.status}]` : "";
        const description = item.description ? `: ${inlineMarkdown(item.description)}` : "";
        return `${index + 1}. **${inlineMarkdown(item.title)}**${status}${description}`;
      });
      return [heading(card.title), "", ...steps].join("\n");
    }
    case "tabs": {
      const tabs = card.items.map((item) => [
        `#### ${inlineMarkdown(item.label)}${item.badge ? ` (${inlineMarkdown(item.badge)})` : ""}`,
        "",
        contentBlocksToMarkdown(item.blocks),
      ].join("\n"));
      return [heading(card.title), "", ...tabs].join("\n\n");
    }
    case "accordion": {
      const sections = card.items.map((item) => [
        `#### ${inlineMarkdown(item.title)}${item.status ? ` [${item.status}]` : ""}`,
        ...(item.summary ? ["", plainMarkdown(item.summary)] : []),
        "",
        contentBlocksToMarkdown(item.blocks),
      ].join("\n"));
      return [heading(card.title), "", ...sections].join("\n\n");
    }
    case "data-table": {
      const rows = card.rows.map((row) => card.columns.map((column) => cellToMarkdown(row[column.id] ?? null)));
      return [heading(card.title), "", markdownTable(card.columns.map((column) => column.label), rows)].join("\n");
    }
    case "bar-chart":
    case "line-chart":
    case "area-chart":
      return cartesianChartToMarkdown(card);
    case "donut-chart": {
      const rows = card.items.map((item) => [item.label, String(item.value)]);
      return [
        heading(card.title),
        ...metaLine([
          card.centerLabel ? `Center label: ${card.centerLabel}` : "",
          card.centerValue ? `Center value: ${card.centerValue}` : "",
          card.unit ? `Unit: ${card.unit}` : "",
        ]),
        "",
        markdownTable(["Slice", card.unit ? `Value (${card.unit})` : "Value"], rows),
      ].join("\n");
    }
    case "sparkline": {
      const rows = card.data.map((value, index) => [String(index + 1), String(value)]);
      return [
        heading(card.title),
        ...metaLine([
          card.value ? `Value: ${card.value}` : "",
          card.detail ?? "",
          card.trend ? `Trend: ${card.trend.direction} (${card.trend.label})` : "",
        ]),
        "",
        markdownTable(["Point", "Value"], rows),
      ].join("\n");
    }
    case "heatmap": {
      const rows = card.rows.map((row) => [row.label, ...row.values.map((value) => chartValue(value))]);
      return [
        heading(card.title),
        ...metaLine([
          card.lowLabel ? `Low: ${card.lowLabel}` : "",
          card.highLabel ? `High: ${card.highLabel}` : "",
          card.unit ? `Unit: ${card.unit}` : "",
        ]),
        "",
        markdownTable(["", ...card.columns], rows),
      ].join("\n");
    }
    case "status": {
      const rows = [
        ["Status", card.status],
        ["Label", card.label],
        ...(card.description ? [["Description", card.description]] : []),
        ...(card.detail ? [["Detail", card.detail]] : []),
      ];
      return [heading(card.title), "", markdownTable(["Field", "Value"], rows)].join("\n");
    }
    case "key-value": {
      const rows = card.items.map((item) => [
        item.label,
        item.value,
        [item.description ?? "", item.style === "code" ? "code" : ""].filter((part) => part !== "").join("; "),
      ]);
      return [heading(card.title), "", markdownTable(["Key", "Value", "Notes"], rows)].join("\n");
    }
    case "progress": {
      const rows = card.items.map((item) => [
        item.label,
        `${item.value}%`,
        item.status ?? "",
        item.detail ?? "",
      ]);
      return [heading(card.title), "", markdownTable(["Item", "Progress", "Status", "Detail"], rows)].join("\n");
    }
    case "checklist": {
      const items = card.items.map((item, index) => {
        const description = item.description ? `: ${inlineMarkdown(item.description)}` : "";
        return `${index + 1}. **${inlineMarkdown(item.label)}** [${item.status}]${description}`;
      });
      return [heading(card.title), "", ...items].join("\n");
    }
    case "callout": {
      const lines = [`**Tone:** ${inlineMarkdown(card.tone)}`, "", plainMarkdown(card.text)];
      if (card.points) lines.push("", ...card.points.map((point) => `- ${inlineMarkdown(point)}`));
      return [heading(card.title), "", ...lines].join("\n");
    }
    default: {
      const exhaustive: never = card;
      return exhaustive;
    }
  }
}
