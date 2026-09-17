import { VISUAL_CARD_CATALOG } from "./catalog";
import { VISUAL_CARD_TYPES, type VisualCardType } from "./schema";

export const VISUAL_CARD_PROMPT_MARKER = "<pi-web-visual-cards version=\"1\">";

const CONTENT_BLOCK_TYPES = new Set<VisualCardType>(["tabs", "accordion"]);
const CARTESIAN_CHART_TYPES = new Set<VisualCardType>(["bar-chart", "line-chart", "area-chart"]);
const CHART_TYPES = new Set<VisualCardType>([
  ...CARTESIAN_CHART_TYPES,
  "donut-chart",
  "sparkline",
  "heatmap",
]);

export function buildVisualCardSystemPrompt(
  enabledTypes: readonly VisualCardType[] = VISUAL_CARD_TYPES,
): string {
  const enabled = new Set(enabledTypes);
  const catalog = Object.entries(VISUAL_CARD_CATALOG)
    .filter(([type]) => enabled.has(type as VisualCardType))
    .map(([type, entry]) => (
      `- ${type}: ${entry.description} ${entry.fields}. Example: ${JSON.stringify(entry.example)}`
    ));
  if (catalog.length === 0) return "";

  const contentBlockTypes = enabledTypes.filter((type) => CONTENT_BLOCK_TYPES.has(type));
  const hasContentBlocks = contentBlockTypes.length > 0;
  const hasCartesianChart = enabledTypes.some((type) => CARTESIAN_CHART_TYPES.has(type));
  const hasChart = enabledTypes.some((type) => CHART_TYPES.has(type));
  const hasDataTable = enabled.has("data-table");
  const contentBlockNames = contentBlockTypes.join("/");
  const seriesAndColumnNames = [
    ...(hasCartesianChart ? ["chart series"] : []),
    ...(hasDataTable ? ["data-table column"] : []),
  ].join(" and ");
  const identifierRules = [
    "card ids match ^[A-Za-z][A-Za-z0-9_-]{0,63}$",
    ...(hasContentBlocks ? [`${contentBlockNames} item ids match ^[A-Za-z][A-Za-z0-9_-]{0,47}$`] : []),
    ...(seriesAndColumnNames ? [`${seriesAndColumnNames} ids match ^[A-Za-z][A-Za-z0-9_-]{0,31}$`] : []),
  ];
  const toneTypes = ["status", "callout"].filter((type) => enabled.has(type as VisualCardType));
  const enumRules = [
    ...(toneTypes.length > 0 ? [`${toneTypes.join(" and ")} tone are neutral|info|success|warning|error`] : []),
    ...(enabled.has("progress") ? ["progress status is neutral|success|warning|error", "progress values are numbers from 0 to 100"] : []),
    ...(enabled.has("sparkline") ? ["sparkline trend direction is up|down|flat"] : []),
    ...(enabled.has("checklist") ? ["checklist status is complete|current|pending"] : []),
    ...(enabled.has("key-value") ? ["key-value style is text|code"] : []),
  ];
  const chartRules = [
    ...(hasCartesianChart ? ["cartesian labels are 2-24 and every one of the 1-4 series value arrays must contain exactly one finite number or null per label"] : []),
    ...(enabled.has("heatmap") ? ["heatmap columns are 1-16 unique plain labels and every row value array must contain exactly one entry per column", "heatmaps need at least one numeric value"] : []),
    ...(enabled.has("donut-chart") ? ["donut-chart values are 2-8 non-negative numbers with at least one positive value"] : []),
  ];

  return [
    VISUAL_CARD_PROMPT_MARKER,
    "This client can render trusted visual cards embedded in ordinary Markdown responses.",
    "Use a visual card only when structured presentation is materially clearer than prose. Keep explanations in Markdown and place each card where it supports the explanation.",
    "Emit each card as one complete fenced code block with the exact language pi-ui. The body must be one strict JSON object. Common fields are version: 1, id, type, title, and fallback.",
    ...(hasContentBlocks ? [`${contentBlockNames[0]?.toUpperCase()}${contentBlockNames.slice(1)} blocks are: text { type, text<=1000 chars }; list { type, style?: bullet|numbered, items: 1-12 strings<=300 chars }; key-value { type, items: 1-12 { label<=80 chars, value<=300 chars } }; code { type, language?, code<=4000 chars } where language matches ^[A-Za-z0-9_+-]{1,24}$; table { type, columns: 1-6 strings<=80 chars, rows: 1-20 string arrays with cells<=240 chars } with every row matching the column count. Panels contain 1-8 blocks and blocks never nest.`] : []),
    `Identifier rules: ${identifierRules.join("; ")}; ids are unique within their list.${hasDataTable ? " Data-table date cells use ISO dates/date-times, status cells use neutral|success|warning|error, number cells are finite JSON numbers, other non-null cells are strings up to 500 chars, and every row contains exactly the declared column ids." : ""}`,
    ...(hasChart ? [`Chart and matrix rules: ${chartRules.join("; ")}${chartRules.length > 0 ? ". " : ""}Charts are static and browser-local: no zoom, pan, drill-down, live data, or external requests, and tooltips and legends are display-only. Never provide colors, palettes, sizes, styles, number formats, axis ranges, or other chart options; the host supplies the fixed palette and its own formatting.`] : []),
    ...(enumRules.length > 0 ? [`Fixed enums: ${enumRules.join("; ")}.`] : []),
    ...catalog,
    "Rules:",
    "- Use only the documented fields and enum values. Do not emit HTML, JavaScript, event handlers, URLs, styles, colors, icons, or executable actions.",
    "- All strings are plain text. Keep cards concise and provide an accurate standalone fallback.",
    ...(hasContentBlocks || hasDataTable ? [`- ${hasContentBlocks ? `${contentBlockNames[0]?.toUpperCase()}${contentBlockNames.slice(1)} may contain only the documented non-recursive plain-text blocks. ` : ""}${hasDataTable ? "Use data-table only for genuinely tabular records; its search, sort, filter, copy, CSV, and pagination controls are local display behavior, not actions." : ""}`] : []),
    ...(hasChart ? ["- Charts and matrices are static local views, not live dashboards. Use them only for real measured values, never for invented or illustrative numbers."] : []),
    "- Never invent metrics or chart-like values. If the facts are uncertain, explain the uncertainty in Markdown instead.",
    "- Do not turn an entire response into cards and do not use a card when a short paragraph or list is clearer.",
    "- To show pi-ui source as an example instead of rendering it, use a json fence or wrap it in a longer outer Markdown fence.",
    "</pi-web-visual-cards>",
  ].join("\n");
}

export const VISUAL_CARD_SYSTEM_PROMPT = buildVisualCardSystemPrompt();

export function appendVisualCardPrompt(
  base: string[],
  enabledTypes: readonly VisualCardType[] = VISUAL_CARD_TYPES,
): string[] {
  const prompt = buildVisualCardSystemPrompt(enabledTypes);
  if (!prompt || base.some((item) => item.includes(VISUAL_CARD_PROMPT_MARKER))) return base;
  return [...base, prompt];
}

export function withVisualCardPrompt(
  base: string,
  enabledTypes: readonly VisualCardType[] = VISUAL_CARD_TYPES,
): string {
  const prompt = buildVisualCardSystemPrompt(enabledTypes);
  if (!prompt || base.includes(VISUAL_CARD_PROMPT_MARKER)) return base;
  return [base.trim(), prompt].filter(Boolean).join("\n\n");
}
