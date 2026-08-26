import { defaultCommandRunner, type CommandRunner } from "../exec.js";
import type { StageBackend } from "../types.js";
import { createFinding } from "./finding.js";

function parseExistingPrUrl(stdout: string): string | undefined {
  try {
    const parsed = JSON.parse(stdout) as { url?: string };
    return parsed.url;
  } catch (error) {
    console.error("checkpoint: failed to parse `gh pr view` output", error);
    return undefined;
  }
}

export function createPrBackend(
  runner: CommandRunner = defaultCommandRunner,
): StageBackend {
  return {
    async run(context) {
      const view = await runner("gh", ["pr", "view", "--json", "url"], {
        cwd: context.cwd,
      });

      if (view.code === 0) {
        const url = parseExistingPrUrl(view.stdout);
        return {
          status: "passed",
          findings: [
            createFinding({
              description: `PR already exists: ${url ?? view.stdout.trim()}`,
              severity: "info",
            }),
          ],
        };
      }

      const create = await runner("gh", ["pr", "create", "--fill"], {
        cwd: context.cwd,
      });

      if (create.code !== 0) {
        return {
          status: "failed",
          findings: [
            createFinding({
              description: create.stderr.trim() || "gh pr create failed",
              severity: "error",
            }),
          ],
        };
      }

      return {
        status: "passed",
        findings: [
          createFinding({
            description: create.stdout.trim(),
            severity: "info",
          }),
        ],
      };
    },
  };
}

export const prBackend = createPrBackend();
