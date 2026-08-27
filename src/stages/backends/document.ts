import { defaultCommandRunner, type CommandRunner } from "../exec.js";
import type { StageBackend } from "../types.js";
import { createFinding } from "./finding.js";

const DOC_FILE_PATTERN = /^(README(\.\w+)?|docs\/)/i;

export function createDocumentBackend(
  runner: CommandRunner = defaultCommandRunner,
): StageBackend {
  return {
    async run(context) {
      const diff = await runner("git", ["diff", "--name-only", "HEAD"], {
        cwd: context.cwd,
      });
      const files = diff.stdout
        .split("\n")
        .map((file) => file.trim())
        .filter(Boolean);

      const sourceChanged = files.some((file) => file.startsWith("src/"));
      const docsChanged = files.some((file) => DOC_FILE_PATTERN.test(file));

      if (sourceChanged && !docsChanged) {
        return {
          status: "passed",
          findings: [
            createFinding({
              description:
                "source changed without a docs update — consider updating README/docs",
              severity: "info",
            }),
          ],
        };
      }

      return { status: "passed" };
    },
  };
}

export const documentBackend = createDocumentBackend();
