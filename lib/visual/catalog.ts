import type { VisualCard, VisualCardType } from "./schema";

export interface VisualCardCatalogEntry {
  description: string;
  fields: string;
  example: VisualCard;
}

export const VISUAL_CARD_CATALOG = {
  metrics: {
    description: "A compact set of measured values or key facts.",
    fields: "items: 1-6 entries with label, value, optional detail, and optional trend { direction: up|down|flat, label }",
    example: {
      version: 1,
      id: "release-metrics",
      type: "metrics",
      title: "Release status",
      items: [
        { label: "Tests", value: "128 passed", detail: "Full suite" },
        { label: "Bundle", value: "412 KB", trend: { direction: "down", label: "18 KB smaller" } },
      ],
      fallback: "Release status: 128 tests passed and the bundle is 412 KB.",
    },
  },
  comparison: {
    description: "A side-by-side comparison of two to four choices.",
    fields: "items: 2-4 entries with title, optional badge, optional summary, and 1-8 points",
    example: {
      version: 1,
      id: "storage-options",
      type: "comparison",
      title: "Storage options",
      items: [
        { title: "SQLite", badge: "Recommended", points: ["Simple deployment", "Transactional"] },
        { title: "PostgreSQL", points: ["Better concurrency", "Requires a service"] },
      ],
      fallback: "SQLite is simpler to deploy; PostgreSQL supports greater concurrency.",
    },
  },
  steps: {
    description: "An ordered process, plan, or progress sequence.",
    fields: "items: 1-8 entries with title, optional description, and optional status complete|current|pending",
    example: {
      version: 1,
      id: "deployment-steps",
      type: "steps",
      title: "Deployment",
      items: [
        { title: "Run tests", status: "complete" },
        { title: "Build artifacts", status: "current" },
        { title: "Deploy", status: "pending" },
      ],
      fallback: "Deployment steps: run tests, build artifacts, then deploy.",
    },
  },
  tabs: {
    description: "Parallel views of related information in a keyboard-accessible tab set.",
    fields: "items: 2-6 entries with unique id, label, optional badge, and 1-8 plain-text content blocks (text, list, key-value, code, or table)",
    example: {
      version: 1,
      id: "platform-notes",
      type: "tabs",
      title: "Platform notes",
      items: [
        { id: "linux", label: "Linux", badge: "Recommended", blocks: [{ type: "list", items: ["Use systemd", "Store data under /var/lib/app"] }] },
        { id: "windows", label: "Windows", blocks: [{ type: "text", text: "Run the service under a dedicated account." }] },
      ],
      fallback: "Platform notes for Linux and Windows deployments.",
    },
  },
  accordion: {
    description: "Expandable groups for optional detail, diagnostics, or grouped findings.",
    fields: "items: 1-10 entries with unique id, title, optional summary/status neutral|success|warning|error, and 1-8 plain-text content blocks",
    example: {
      version: 1,
      id: "release-checks",
      type: "accordion",
      title: "Release checks",
      items: [
        { id: "tests", title: "Test suite", status: "success", blocks: [{ type: "text", text: "All 128 tests passed." }] },
        { id: "bundle", title: "Bundle review", status: "warning", blocks: [{ type: "key-value", items: [{ label: "Size", value: "412 KB" }, { label: "Budget", value: "400 KB" }] }] },
      ],
      fallback: "Release checks: tests passed; the bundle is 12 KB over budget.",
    },
  },
  "data-table": {
    description: "A searchable, sortable, paginated table of typed records with local copy and CSV export.",
    fields: "columns: 1-8 unique id/label/dataType(text|number|date|status|code) entries; rows: 1-100 objects containing every column id with matching values or null",
    example: {
      version: 1,
      id: "test-results",
      type: "data-table",
      title: "Test results",
      columns: [
        { id: "suite", label: "Suite", dataType: "text" },
        { id: "passed", label: "Passed", dataType: "number", align: "end" },
        { id: "status", label: "Status", dataType: "status" },
      ],
      rows: [
        { suite: "Unit", passed: 128, status: "success" },
        { suite: "Integration", passed: 42, status: "warning" },
      ],
      fallback: "Test results: Unit passed 128 tests; Integration passed 42 with warnings.",
    },
  },
  "bar-chart": {
    description: "A comparison of categorical values across one or more series.",
    fields: "labels: 2-24 strings (48 chars each); series: 1-4 unique id/label/values entries where values must have exactly one finite number or null per label; optional xLabel/yLabel (48 chars), unit (24 chars), showLegend, stacked (boolean)",
    example: {
      version: 1,
      id: "traffic-bars",
      type: "bar-chart",
      title: "Traffic by month",
      labels: ["Jan", "Feb", "Mar"],
      series: [
        { id: "requests", label: "Requests", values: [120, 150, 180] },
        { id: "errors", label: "Errors", values: [3, null, 7] },
      ],
      xLabel: "Month",
      yLabel: "Count",
      unit: "req",
      stacked: true,
      fallback: "Traffic rose from 120 to 180 requests; errors stayed below 7.",
    },
  },
  "line-chart": {
    description: "A trend of one or more series across ordered labels.",
    fields: "labels: 2-24 strings (48 chars each); series: 1-4 unique id/label/values entries where values must have exactly one finite number or null per label; optional xLabel/yLabel (48 chars), unit (24 chars), showLegend",
    example: {
      version: 1,
      id: "latency-line",
      type: "line-chart",
      title: "p95 latency",
      labels: ["P50", "P95", "P99"],
      series: [{ id: "latency", label: "Milliseconds", values: [12, 45, 90] }],
      xLabel: "Percentile",
      yLabel: "Latency",
      unit: "ms",
      fallback: "p95 latency rises from 12 ms to 90 ms across percentiles.",
    },
  },
  "area-chart": {
    description: "A magnitude trend that emphasizes cumulative volume.",
    fields: "labels: 2-24 strings (48 chars each); series: 1-4 unique id/label/values entries where values must have exactly one finite number or null per label; optional xLabel/yLabel (48 chars), unit (24 chars), showLegend, stacked (boolean)",
    example: {
      version: 1,
      id: "storage-area",
      type: "area-chart",
      title: "Storage growth",
      labels: ["Q1", "Q2", "Q3"],
      series: [{ id: "used", label: "Used (GB)", values: [10, 20, 35] }],
      unit: "GB",
      fallback: "Storage grew from 10 GB to 35 GB.",
    },
  },
  "donut-chart": {
    description: "A part-to-whole split of a few non-negative slices.",
    fields: "items: 2-8 label (48 chars)/value entries with finite non-negative numbers and at least one positive value; optional centerLabel (48 chars), centerValue (64 chars), unit (24 chars)",
    example: {
      version: 1,
      id: "traffic-donut",
      type: "donut-chart",
      title: "Traffic share",
      items: [
        { label: "Direct", value: 60 },
        { label: "Search", value: 40 },
      ],
      centerLabel: "Total",
      centerValue: "100",
      unit: "%",
      fallback: "Direct accounts for 60% of traffic and search for 40%.",
    },
  },
  sparkline: {
    description: "A compact inline trend for a single series.",
    fields: "data: 2-48 finite numbers; optional value (64 chars), detail (160 chars), and trend { direction: up|down|flat, label (48 chars) }",
    example: {
      version: 1,
      id: "uptime-sparkline",
      type: "sparkline",
      title: "Uptime",
      data: [98, 99, 97, 100],
      value: "99.5%",
      detail: "Last 4 days",
      trend: { direction: "up", label: "Improving" },
      fallback: "Uptime is 99.5% over the last 4 days and improving.",
    },
  },
  heatmap: {
    description: "A dense matrix of values across labelled rows and columns.",
    fields: "columns: 1-16 unique strings (32 chars each); rows: 1-12 label (48 chars)/values entries where values must have exactly one finite number or null per column and at least one value is numeric; optional lowLabel/highLabel (32 chars), unit (24 chars)",
    example: {
      version: 1,
      id: "cluster-heatmap",
      type: "heatmap",
      title: "Cluster load",
      columns: ["Mon", "Tue", "Wed"],
      rows: [
        { label: "API", values: [10, 20, null] },
        { label: "DB", values: [5, null, 8] },
      ],
      lowLabel: "Idle",
      highLabel: "Busy",
      unit: "qps",
      fallback: "API load peaks at 20 qps; DB stays below 8 qps.",
    },
  },
  status: {
    description: "A single current condition with a semantic tone.",
    fields: "status: neutral|info|success|warning|error; label (80 chars); optional description (500 chars) and detail (160 chars)",
    example: {
      version: 1,
      id: "deploy-status",
      type: "status",
      title: "Deploy status",
      status: "warning",
      label: "Deploy pending",
      description: "Waiting for approval",
      detail: "Run #42",
      fallback: "Deploy pending: waiting for approval for run #42.",
    },
  },
  "key-value": {
    description: "A flat list of labelled values for configuration or facts.",
    fields: "items: 1-16 entries with label (80 chars), value (300 chars), optional description (200 chars) and style text|code",
    example: {
      version: 1,
      id: "runtime-config",
      type: "key-value",
      title: "Runtime config",
      items: [
        { label: "Region", value: "us-east-1" },
        { label: "Image", value: "app:2.1", description: "Signed digest", style: "code" },
      ],
      fallback: "Runtime config: region us-east-1, image app:2.1.",
    },
  },
  progress: {
    description: "A set of completion meters for known work.",
    fields: "items: 1-8 entries with label (80 chars), value as a number from 0 to 100, optional detail (160 chars) and status neutral|success|warning|error",
    example: {
      version: 1,
      id: "migration-progress",
      type: "progress",
      title: "Migration",
      items: [
        { label: "Tables", value: 75, detail: "3 of 4 migrated", status: "warning" },
        { label: "Indexes", value: 100, status: "success" },
      ],
      fallback: "Migration: tables 75% complete; indexes done.",
    },
  },
  checklist: {
    description: "A short list of tasks with their completion state.",
    fields: "items: 1-20 entries with label (120 chars), status complete|current|pending, and optional description (300 chars)",
    example: {
      version: 1,
      id: "release-checklist",
      type: "checklist",
      title: "Release checklist",
      items: [
        { label: "Run tests", status: "complete" },
        { label: "Update changelog", description: "Add release notes", status: "current" },
        { label: "Tag release", status: "pending" },
      ],
      fallback: "Release checklist: tests done, changelog in progress, tag pending.",
    },
  },
  callout: {
    description: "A short emphasized note with an optional list of points.",
    fields: "tone: neutral|info|success|warning|error; text (1000 chars); optional points: 1-8 strings (300 chars each)",
    example: {
      version: 1,
      id: "migration-callout",
      type: "callout",
      title: "Before you migrate",
      tone: "warning",
      text: "The migration is irreversible.",
      points: ["Back up the database first", "Schedule a maintenance window"],
      fallback: "Warning: the migration is irreversible; back up first and schedule a window.",
    },
  },
} as const satisfies Record<VisualCardType, VisualCardCatalogEntry>;
