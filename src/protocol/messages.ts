export interface RunRequest {
  type: "run";
  cwd: string;
}

export interface StatusRequest {
  type: "status";
}

export interface RunSummary {
  id: string;
  repo: string;
  status: "running" | "passed" | "failed";
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

export interface OutcomeMessage {
  type: "outcome";
  runId: string;
  status: "passed" | "failed";
}

export type DaemonEvent =
  StageStartedEvent | StageFinishedEvent | OutcomeMessage | StatusResponse;

export type ClientRequest = RunRequest | StatusRequest;
