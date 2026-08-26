import { defaultCommandRunner, type CommandRunner } from "../exec.js";
import type { StageBackend } from "../types.js";
import { commandFailureResult } from "./finding.js";

export function createCiBackend(
  runner: CommandRunner = defaultCommandRunner,
): StageBackend {
  return {
    async run(context) {
      const result = await runner("gh", ["pr", "checks", "--watch"], {
        cwd: context.cwd,
      });

      if (result.code !== 0) {
        return commandFailureResult(result, "CI checks failed");
      }

      return { status: "passed" };
    },
  };
}

export const ciBackend = createCiBackend();
