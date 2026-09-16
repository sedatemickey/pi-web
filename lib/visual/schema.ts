import { z } from "zod";

export const VISUAL_PROTOCOL_VERSION = 1 as const;
export const MAX_VISUAL_CARD_SOURCE_BYTES = 24 * 1024;
export const MAX_VISUAL_CARD_JSON_DEPTH = 8;
export const MAX_VISUAL_CARDS_PER_TEXT_BLOCK = 12;

const requiredText = (max: number) => z.string().min(1).max(max).refine(
  (value) => value.trim().length > 0,
  { message: "Must contain visible text" },
);

const optionalText = (max: number) => requiredText(max).optional();

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

export const visualCardSchema = z.discriminatedUnion("type", [
  metricsCardSchema,
  comparisonCardSchema,
  stepsCardSchema,
]);

export type MetricsCard = z.infer<typeof metricsCardSchema>;
export type ComparisonCard = z.infer<typeof comparisonCardSchema>;
export type StepsCard = z.infer<typeof stepsCardSchema>;
export type VisualCard = z.infer<typeof visualCardSchema>;
export type VisualCardType = VisualCard["type"];

export const VISUAL_CARD_TYPES = ["metrics", "comparison", "steps"] as const satisfies readonly VisualCardType[];
