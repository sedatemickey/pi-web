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
} as const satisfies Record<VisualCardType, VisualCardCatalogEntry>;
