import { z } from "zod";
import { STAGE_ORDER } from "../stages/types.js";

const stageNameSchema = z.enum(STAGE_ORDER);

const findingSchema = z.object({
  id: z.string(),
  severity: z.enum(["info", "warning", "error"]),
  file: z.string().optional(),
  line: z.number().optional(),
  description: z.string(),
  action: z.enum(["auto-fix", "no-op", "ask-user"]),
});

export const runRequestSchema = z.object({
  type: z.literal("run"),
  cwd: z.string(),
});
export type RunRequest = z.infer<typeof runRequestSchema>;

export const statusRequestSchema = z.object({
  type: z.literal("status"),
});
export type StatusRequest = z.infer<typeof statusRequestSchema>;

export const respondActionSchema = z.enum(["approve", "skip", "fix"]);
export type RespondAction = z.infer<typeof respondActionSchema>;

export const respondRequestSchema = z.object({
  type: z.literal("respond"),
  runId: z.string(),
  action: respondActionSchema,
  findingIds: z.array(z.string()).optional(),
});
export type RespondRequest = z.infer<typeof respondRequestSchema>;

export const abortRequestSchema = z.object({
  type: z.literal("abort"),
  runId: z.string(),
});
export type AbortRequest = z.infer<typeof abortRequestSchema>;

export const runSummarySchema = z.object({
  id: z.string(),
  repo: z.string(),
  status: z.enum(["running", "gated", "passed", "failed", "aborted"]),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
});
export type RunSummary = z.infer<typeof runSummarySchema>;

export const statusResponseSchema = z.object({
  type: z.literal("status_response"),
  runs: z.array(runSummarySchema),
});
export type StatusResponse = z.infer<typeof statusResponseSchema>;

export const stageStartedEventSchema = z.object({
  type: z.literal("stage_started"),
  runId: z.string(),
  stage: stageNameSchema,
});
export type StageStartedEvent = z.infer<typeof stageStartedEventSchema>;

export const stageFinishedEventSchema = z.object({
  type: z.literal("stage_finished"),
  runId: z.string(),
  stage: stageNameSchema,
  status: z.enum(["passed", "failed"]),
});
export type StageFinishedEvent = z.infer<typeof stageFinishedEventSchema>;

export const gateHitEventSchema = z.object({
  type: z.literal("gate_hit"),
  runId: z.string(),
  stage: stageNameSchema,
  findings: z.array(findingSchema),
});
export type GateHitEvent = z.infer<typeof gateHitEventSchema>;

export const outcomeMessageSchema = z.object({
  type: z.literal("outcome"),
  runId: z.string(),
  status: z.enum(["passed", "failed", "aborted"]),
});
export type OutcomeMessage = z.infer<typeof outcomeMessageSchema>;

export const daemonEventSchema = z.discriminatedUnion("type", [
  stageStartedEventSchema,
  stageFinishedEventSchema,
  gateHitEventSchema,
  outcomeMessageSchema,
  statusResponseSchema,
]);
export type DaemonEvent = z.infer<typeof daemonEventSchema>;

export const runEventSchema = z.discriminatedUnion("type", [
  stageStartedEventSchema,
  stageFinishedEventSchema,
  gateHitEventSchema,
  outcomeMessageSchema,
]);
export type RunEvent = z.infer<typeof runEventSchema>;

export const clientRequestSchema = z.discriminatedUnion("type", [
  runRequestSchema,
  statusRequestSchema,
  respondRequestSchema,
  abortRequestSchema,
]);
export type ClientRequest = z.infer<typeof clientRequestSchema>;
