import { randomUUID } from "node:crypto";
import type { CommandResult } from "../exec.js";
import type { Finding, StageResult } from "../types.js";

export function createFinding(input: Omit<Finding, "id" | "action">): Finding {
  return { id: randomUUID(), action: "no-op", ...input };
}

export function commandFailureResult(
  result: CommandResult,
  fallbackDescription: string,
): StageResult {
  return {
    status: "failed",
    findings: [
      createFinding({
        description:
          result.stderr.trim() || result.stdout.trim() || fallbackDescription,
        severity: "error",
      }),
    ],
  };
}
