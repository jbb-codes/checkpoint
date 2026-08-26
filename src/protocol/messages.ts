import type { Finding } from "../stages/types.js";

export interface RunRequest {
  type: "run";
  cwd: string;
}

export interface StatusRequest {
  type: "status";
}

export type RespondAction = "approve" | "skip" | "fix";

export interface RespondRequest {
  type: "respond";
  runId: string;
  action: RespondAction;
  findingIds?: string[];
}

export interface AbortRequest {
  type: "abort";
  runId: string;
}

export interface RunSummary {
  id: string;
  repo: string;
  status: "running" | "gated" | "passed" | "failed" | "aborted";
  startedAt: string;
  finishedAt: string | null;
}

export interface StatusResponse {
  type: "status_response";
  runs: RunSummary[];
}

export interface StageStartedEvent {
  type: "stage_started";
  runId: string;
  stage: string;
}

export interface StageFinishedEvent {
  type: "stage_finished";
  runId: string;
  stage: string;
  status: "passed" | "failed";
}

export interface GateHitEvent {
  type: "gate_hit";
  runId: string;
  stage: string;
  findings: Finding[];
}

export interface OutcomeMessage {
  type: "outcome";
  runId: string;
  status: "passed" | "failed" | "aborted";
}

export type DaemonEvent =
  | StageStartedEvent
  | StageFinishedEvent
  | GateHitEvent
  | OutcomeMessage
  | StatusResponse;

export type ClientRequest =
  RunRequest | StatusRequest | RespondRequest | AbortRequest;
