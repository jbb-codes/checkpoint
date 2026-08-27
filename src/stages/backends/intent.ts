import type { StageBackend } from "../types.js";
import { createFinding } from "./finding.js";

export function createIntentBackend(): StageBackend {
  return {
    // eslint-disable-next-line @typescript-eslint/require-await -- must satisfy StageBackend.run's async contract, matching real backends
    async run(context) {
      if ((context.intent ?? "").trim().length === 0) {
        return {
          status: "failed",
          findings: [
            createFinding({
              description:
                "no intent provided — pass --intent describing what this change is meant to accomplish",
              severity: "error",
              action: "ask-user",
            }),
          ],
        };
      }

      return { status: "passed" };
    },
  };
}

export const intentBackend = createIntentBackend();
