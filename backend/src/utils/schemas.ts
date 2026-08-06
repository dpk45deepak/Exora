import { z } from "zod";

const statSchema = z.object({
  mean: z.number().finite(),
  stddev: z.number().finite().nonnegative(),
  min: z.number().finite(),
  max: z.number().finite(),
});

export const telemetryBatchSchema = z.object({
  sessionId: z.string().uuid(),
  windowStart: z.number(),
  windowEnd: z.number(),
  keystrokeCount: z.number().int().nonnegative().max(100_000),
  holdTime: statSchema,
  flightTime: statSchema,
  focusLossCount: z.number().int().nonnegative().max(10_000),
  pasteCount: z.number().int().nonnegative().max(10_000),
  copyCount: z.number().int().nonnegative().max(10_000),
  blurEvents: z
    .array(z.object({ ts: z.number(), kind: z.enum(["blur", "focus"]) }))
    .max(1000),
  immediate: z.boolean().optional(),
});

export type TelemetryBatchInput = z.infer<typeof telemetryBatchSchema>;

export const createSessionSchema = z.object({
  examTitle: z.string().min(1).max(300),
});
