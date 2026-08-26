import { defaultCommandRunner, type CommandRunner } from "../exec.js";
import type { StageBackend } from "../types.js";
import { createFinding } from "./finding.js";

export function createCiBackend(
  runner: CommandRunner = defaultCommandRunner,
): StageBackend {
  return {
    async run(context) {
      const result = await runner("gh", ["pr", "checks", "--watch"], {
        cwd: context.cwd,
      });

      if (result.code !== 0) {
        return {
          status: "failed",
          findings: [
            createFinding({
              description:
                result.stderr.trim() ||
                result.stdout.trim() ||
                "CI checks failed",
              severity: "error",
            }),
          ],
        };
      }

      return { status: "passed" };
    },
  };
}

export const ciBackend = createCiBackend();
