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
}

export interface Finding {
  message: string;
  severity: "error" | "warning" | "info";
  file?: string;
  line?: number;
}

export interface StageResult {
  status: "passed" | "failed";
  findings?: Finding[];
}

export interface StageBackend {
  run(context: StageContext): Promise<StageResult>;
}
