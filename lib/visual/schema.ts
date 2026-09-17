import { z } from "zod";

export const VISUAL_PROTOCOL_VERSION = 1 as const;
export const MAX_VISUAL_CARD_SOURCE_BYTES = 24 * 1024;
export const MAX_VISUAL_CARD_JSON_DEPTH = 8;
export const MAX_VISUAL_CARDS_PER_TEXT_BLOCK = 12;
export const MAX_DATA_TABLE_ROWS = 100;
export const DATA_TABLE_PAGE_SIZE = 20;

const semanticStatus = z.enum(["neutral", "info", "success", "warning", "error"]);
const progressStatus = z.enum(["neutral", "success", "warning", "error"]);

const requiredText = (max: number) => z.string().min(1).max(max).refine(
  (value) => value.trim().length > 0,
  { message: "Must contain visible text" },
);

const optionalText = (max: number) => requiredText(max).optional();
const itemId = z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,47}$/);
const columnId = z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,31}$/);

const baseShape = {
  version: z.literal(VISUAL_PROTOCOL_VERSION),
  id: z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,63}$/),
  title: requiredText(120),
  fallback: requiredText(500),
};

export const metricsCardSchema = z.strictObject({
  ...baseShape,
  type: z.literal("metrics"),
  items: z.array(z.strictObject({
    label: requiredText(80),
    value: requiredText(64),
    detail: optionalText(160),
    trend: z.strictObject({
      direction: z.enum(["up", "down", "flat"]),
      label: requiredText(48),
    }).optional(),
  })).min(1).max(6),
});

export const comparisonCardSchema = z.strictObject({
  ...baseShape,
  type: z.literal("comparison"),
  items: z.array(z.strictObject({
    title: requiredText(80),
    badge: optionalText(32),
    summary: optionalText(200),
    points: z.array(requiredText(200)).min(1).max(8),
  })).min(2).max(4),
});

export const stepsCardSchema = z.strictObject({
  ...baseShape,
  type: z.literal("steps"),
  items: z.array(z.strictObject({
    title: requiredText(100),
    description: optionalText(400),
    status: z.enum(["complete", "current", "pending"]).optional(),
  })).min(1).max(8),
});

const textContentBlockSchema = z.strictObject({
  type: z.literal("text"),
  text: requiredText(1_000),
});

const listContentBlockSchema = z.strictObject({
  type: z.literal("list"),
  style: z.enum(["bullet", "numbered"]).optional(),
  items: z.array(requiredText(300)).min(1).max(12),
});

const keyValueContentBlockSchema = z.strictObject({
  type: z.literal("key-value"),
  items: z.array(z.strictObject({
    label: requiredText(80),
    value: requiredText(300),
  })).min(1).max(12),
});

const codeContentBlockSchema = z.strictObject({
  type: z.literal("code"),
  language: z.string().regex(/^[A-Za-z0-9_+-]{1,24}$/).optional(),
  code: requiredText(4_000),
});

const tableContentBlockSchema = z.strictObject({
  type: z.literal("table"),
  columns: z.array(requiredText(80)).min(1).max(6),
  rows: z.array(z.array(z.string().max(240)).min(1).max(6)).min(1).max(20),
});

export const visualContentBlockSchema = z.discriminatedUnion("type", [
  textContentBlockSchema,
  listContentBlockSchema,
  keyValueContentBlockSchema,
  codeContentBlockSchema,
  tableContentBlockSchema,
]);

export const tabsCardSchema = z.strictObject({
  ...baseShape,
  type: z.literal("tabs"),
  items: z.array(z.strictObject({
    id: itemId,
    label: requiredText(48),
    badge: optionalText(32),
    blocks: z.array(visualContentBlockSchema).min(1).max(8),
  })).min(2).max(6),
});

export const accordionCardSchema = z.strictObject({
  ...baseShape,
  type: z.literal("accordion"),
  items: z.array(z.strictObject({
    id: itemId,
    title: requiredText(100),
    summary: optionalText(200),
    status: z.enum(["neutral", "success", "warning", "error"]).optional(),
    blocks: z.array(visualContentBlockSchema).min(1).max(8),
  })).min(1).max(10),
});

export const dataTableColumnSchema = z.strictObject({
  id: columnId,
  label: requiredText(80),
  dataType: z.enum(["text", "number", "date", "status", "code"]),
  align: z.enum(["start", "center", "end"]).optional(),
});

const dataTableCellSchema = z.union([
  z.string().max(500),
  z.number().finite(),
  z.null(),
]);

export const dataTableCardSchema = z.strictObject({
  ...baseShape,
  type: z.literal("data-table"),
  columns: z.array(dataTableColumnSchema).min(1).max(8),
  rows: z.array(z.record(columnId, dataTableCellSchema)).min(1).max(MAX_DATA_TABLE_ROWS),
});

const chartNumber = z.number().finite();
const chartSeriesSchema = z.strictObject({
  id: columnId,
  label: requiredText(48),
  values: z.array(chartNumber.nullable()).min(2).max(24),
});

const cartesianChartShape = {
  ...baseShape,
  labels: z.array(requiredText(48)).min(2).max(24),
  series: z.array(chartSeriesSchema).min(1).max(4),
  xLabel: optionalText(48),
  yLabel: optionalText(48),
  unit: optionalText(24),
  showLegend: z.boolean().optional(),
};

export const barChartCardSchema = z.strictObject({
  ...cartesianChartShape,
  type: z.literal("bar-chart"),
  stacked: z.boolean().optional(),
});

export const lineChartCardSchema = z.strictObject({
  ...cartesianChartShape,
  type: z.literal("line-chart"),
});

export const areaChartCardSchema = z.strictObject({
  ...cartesianChartShape,
  type: z.literal("area-chart"),
  stacked: z.boolean().optional(),
});

export const donutChartCardSchema = z.strictObject({
  ...baseShape,
  type: z.literal("donut-chart"),
  items: z.array(z.strictObject({
    label: requiredText(48),
    value: chartNumber.nonnegative(),
  })).min(2).max(8),
  centerLabel: optionalText(48),
  centerValue: optionalText(64),
  unit: optionalText(24),
});

export const sparklineCardSchema = z.strictObject({
  ...baseShape,
  type: z.literal("sparkline"),
  data: z.array(chartNumber).min(2).max(48),
  value: optionalText(64),
  detail: optionalText(160),
  trend: z.strictObject({
    direction: z.enum(["up", "down", "flat"]),
    label: requiredText(48),
  }).optional(),
});

export const heatmapCardSchema = z.strictObject({
  ...baseShape,
  type: z.literal("heatmap"),
  columns: z.array(requiredText(32)).min(1).max(16),
  rows: z.array(z.strictObject({
    label: requiredText(48),
    values: z.array(chartNumber.nullable()).min(1).max(16),
  })).min(1).max(12),
  lowLabel: optionalText(32),
  highLabel: optionalText(32),
  unit: optionalText(24),
});

export const statusCardSchema = z.strictObject({
  ...baseShape,
  type: z.literal("status"),
  status: semanticStatus,
  label: requiredText(80),
  description: optionalText(500),
  detail: optionalText(160),
});

export const keyValueCardSchema = z.strictObject({
  ...baseShape,
  type: z.literal("key-value"),
  items: z.array(z.strictObject({
    label: requiredText(80),
    value: requiredText(300),
    description: optionalText(200),
    style: z.enum(["text", "code"]).optional(),
  })).min(1).max(16),
});

export const progressCardSchema = z.strictObject({
  ...baseShape,
  type: z.literal("progress"),
  items: z.array(z.strictObject({
    label: requiredText(80),
    value: chartNumber.min(0).max(100),
    detail: optionalText(160),
    status: progressStatus.optional(),
  })).min(1).max(8),
});

export const checklistCardSchema = z.strictObject({
  ...baseShape,
  type: z.literal("checklist"),
  items: z.array(z.strictObject({
    label: requiredText(120),
    description: optionalText(300),
    status: z.enum(["complete", "current", "pending"]),
  })).min(1).max(20),
});

export const calloutCardSchema = z.strictObject({
  ...baseShape,
  type: z.literal("callout"),
  tone: semanticStatus,
  text: requiredText(1_000),
  points: z.array(requiredText(300)).min(1).max(8).optional(),
});

const visualCardBaseSchema = z.discriminatedUnion("type", [
  metricsCardSchema,
  comparisonCardSchema,
  stepsCardSchema,
  tabsCardSchema,
  accordionCardSchema,
  dataTableCardSchema,
  barChartCardSchema,
  lineChartCardSchema,
  areaChartCardSchema,
  donutChartCardSchema,
  sparklineCardSchema,
  heatmapCardSchema,
  statusCardSchema,
  keyValueCardSchema,
  progressCardSchema,
  checklistCardSchema,
  calloutCardSchema,
]);

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2}))?$/;
const TABLE_STATUSES = new Set(["neutral", "success", "warning", "error"]);

function isValidIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1]) return false;
  if (match[4] === undefined) return true;

  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = match[6] === undefined ? 0 : Number(match[6]);
  if (hour > 23 || minute > 59 || second > 59) return false;
  const timezone = match[8];
  if (timezone !== "Z") {
    const [offsetHour, offsetMinute] = timezone.slice(1).split(":").map(Number);
    if (offsetHour > 23 || offsetMinute > 59) return false;
  }
  return !Number.isNaN(Date.parse(value));
}

function addDuplicateIdIssues(
  ids: readonly string[],
  path: (string | number)[],
  ctx: z.RefinementCtx,
): void {
  const seen = new Set<string>();
  ids.forEach((id, index) => {
    if (seen.has(id)) {
      ctx.addIssue({ code: "custom", message: `Duplicate id: ${id}`, path: [...path, index, "id"] });
    }
    seen.add(id);
  });
}

function validateDataTable(card: z.infer<typeof dataTableCardSchema>, ctx: z.RefinementCtx): void {
  addDuplicateIdIssues(card.columns.map((column) => column.id), ["columns"], ctx);
  const columns = new Map(card.columns.map((column) => [column.id, column]));

  card.rows.forEach((row, rowIndex) => {
    const rowKeys = Object.keys(row);
    for (const key of rowKeys) {
      if (!columns.has(key)) {
        ctx.addIssue({ code: "custom", message: `Unknown column: ${key}`, path: ["rows", rowIndex, key] });
      }
    }

    for (const column of card.columns) {
      if (!(column.id in row)) {
        ctx.addIssue({ code: "custom", message: `Missing column: ${column.id}`, path: ["rows", rowIndex, column.id] });
        continue;
      }
      const value = row[column.id];
      if (value === null) continue;

      const valid = column.dataType === "number"
        ? typeof value === "number" && Number.isFinite(value)
        : column.dataType === "date"
          ? typeof value === "string" && isValidIsoDate(value)
          : column.dataType === "status"
            ? typeof value === "string" && TABLE_STATUSES.has(value)
            : typeof value === "string";
      if (!valid) {
        ctx.addIssue({
          code: "custom",
          message: `Cell does not match ${column.dataType} column`,
          path: ["rows", rowIndex, column.id],
        });
      }
    }
  });
}

function validateCartesianChart(
  card: z.infer<typeof barChartCardSchema | typeof lineChartCardSchema | typeof areaChartCardSchema>,
  ctx: z.RefinementCtx,
): void {
  addDuplicateIdIssues(card.series.map((series) => series.id), ["series"], ctx);
  card.series.forEach((series, seriesIndex) => {
    if (series.values.length !== card.labels.length) {
      ctx.addIssue({
        code: "custom",
        message: "Series value count must match the label count",
        path: ["series", seriesIndex, "values"],
      });
    }
  });
}

export const visualCardSchema = visualCardBaseSchema.superRefine((card, ctx) => {
  if (card.type === "tabs" || card.type === "accordion") {
    addDuplicateIdIssues(card.items.map((item) => item.id), ["items"], ctx);
    for (const [itemIndex, item] of card.items.entries()) {
      for (const [blockIndex, block] of item.blocks.entries()) {
        if (block.type !== "table") continue;
        block.rows.forEach((row, rowIndex) => {
          if (row.length !== block.columns.length) {
            ctx.addIssue({
              code: "custom",
              message: "Table row length must match the column count",
              path: ["items", itemIndex, "blocks", blockIndex, "rows", rowIndex],
            });
          }
        });
      }
    }
  } else if (card.type === "data-table") {
    validateDataTable(card, ctx);
  } else if (card.type === "bar-chart" || card.type === "line-chart" || card.type === "area-chart") {
    validateCartesianChart(card, ctx);
  } else if (card.type === "donut-chart") {
    if (!card.items.some((item) => item.value > 0)) {
      ctx.addIssue({ code: "custom", message: "At least one donut value must be positive", path: ["items"] });
    }
  } else if (card.type === "heatmap") {
    const seenColumns = new Set<string>();
    card.columns.forEach((column, columnIndex) => {
      if (seenColumns.has(column)) {
        ctx.addIssue({
          code: "custom",
          message: `Duplicate heatmap column: ${column}`,
          path: ["columns", columnIndex],
        });
      }
      seenColumns.add(column);
    });
    card.rows.forEach((row, rowIndex) => {
      if (row.values.length !== card.columns.length) {
        ctx.addIssue({
          code: "custom",
          message: "Heatmap row length must match the column count",
          path: ["rows", rowIndex, "values"],
        });
      }
    });
    if (!card.rows.some((row) => row.values.some((value) => value !== null))) {
      ctx.addIssue({ code: "custom", message: "Heatmap must contain at least one numeric value", path: ["rows"] });
    }
  }
});

export type MetricsCard = z.infer<typeof metricsCardSchema>;
export type ComparisonCard = z.infer<typeof comparisonCardSchema>;
export type StepsCard = z.infer<typeof stepsCardSchema>;
export type VisualContentBlock = z.infer<typeof visualContentBlockSchema>;
export type TabsCard = z.infer<typeof tabsCardSchema>;
export type AccordionCard = z.infer<typeof accordionCardSchema>;
export type DataTableColumn = z.infer<typeof dataTableColumnSchema>;
export type DataTableCard = z.infer<typeof dataTableCardSchema>;
export type DataTableCell = z.infer<typeof dataTableCellSchema>;
export type BarChartCard = z.infer<typeof barChartCardSchema>;
export type LineChartCard = z.infer<typeof lineChartCardSchema>;
export type AreaChartCard = z.infer<typeof areaChartCardSchema>;
export type DonutChartCard = z.infer<typeof donutChartCardSchema>;
export type SparklineCard = z.infer<typeof sparklineCardSchema>;
export type HeatmapCard = z.infer<typeof heatmapCardSchema>;
export type StatusCard = z.infer<typeof statusCardSchema>;
export type KeyValueCard = z.infer<typeof keyValueCardSchema>;
export type ProgressCard = z.infer<typeof progressCardSchema>;
export type ChecklistCard = z.infer<typeof checklistCardSchema>;
export type CalloutCard = z.infer<typeof calloutCardSchema>;
export type VisualCard = z.infer<typeof visualCardBaseSchema>;
export type VisualCardType = VisualCard["type"];

export const VISUAL_CARD_TYPES = [
  "metrics",
  "comparison",
  "steps",
  "tabs",
  "accordion",
  "data-table",
  "bar-chart",
  "line-chart",
  "area-chart",
  "donut-chart",
  "sparkline",
  "heatmap",
  "status",
  "key-value",
  "progress",
  "checklist",
  "callout",
] as const satisfies readonly VisualCardType[];
