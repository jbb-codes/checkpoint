import { defaultCommandRunner, type CommandRunner } from "../exec.js";
import type { StageBackend } from "../types.js";
import { commandFailureResult } from "./finding.js";

export function createTestBackend(
  runner: CommandRunner = defaultCommandRunner,
): StageBackend {
  return {
    async run(context) {
      const result = await runner("npm", ["test", "--silent"], {
        cwd: context.cwd,
      });

      if (result.code !== 0) {
        return commandFailureResult(result, "tests failed");
      }

      return { status: "passed" };
    },
  };
}

export const testBackend = createTestBackend();
