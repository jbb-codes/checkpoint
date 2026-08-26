import { defaultCommandRunner, type CommandRunner } from "../exec.js";
import type { StageBackend } from "../types.js";

export function createTestBackend(
  runner: CommandRunner = defaultCommandRunner,
): StageBackend {
  return {
    async run(context) {
      const result = await runner("npm", ["test", "--silent"], {
        cwd: context.cwd,
      });

      if (result.code !== 0) {
        return {
          status: "failed",
          findings: [
            {
              message:
                result.stderr.trim() || result.stdout.trim() || "tests failed",
              severity: "error",
            },
          ],
        };
      }

      return { status: "passed" };
    },
  };
}

export const testBackend = createTestBackend();
