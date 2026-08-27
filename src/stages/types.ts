export const STAGE_ORDER = [
  "intent",
  "rebase",
  "review",
  "test",
  "document",
  "lint",
  "push",
  "PR",
  "CI",
] as const;

export type StageName = (typeof STAGE_ORDER)[number];

export interface StageContext {
  runId: string;
  cwd: string;
  intent?: string;
}

export type FindingAction = "auto-fix" | "no-op" | "ask-user";

export interface Finding {
  id: string;
  severity: "info" | "warning" | "error";
  file?: string;
  line?: number;
  description: string;
  action: FindingAction;
}

export interface StageResult {
  status: "passed" | "failed";
  findings?: Finding[];
}

export interface StageBackend {
  run(context: StageContext): Promise<StageResult>;
}
