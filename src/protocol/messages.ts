export interface RunRequest {
  type: "run";
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
  StageStartedEvent | StageFinishedEvent | OutcomeMessage;

export type ClientRequest = RunRequest;
