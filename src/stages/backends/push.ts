import { defaultCommandRunner, type CommandRunner } from "../exec.js";
import type { StageBackend } from "../types.js";
import { commandFailureResult } from "./finding.js";

export function createPushBackend(
  runner: CommandRunner = defaultCommandRunner,
): StageBackend {
  return {
    async run(context) {
      const branch = await runner(
        "git",
        ["rev-parse", "--abbrev-ref", "HEAD"],
        { cwd: context.cwd },
      );

      if (branch.code !== 0) {
        return commandFailureResult(branch, "unable to determine current branch");
      }

      const branchName = branch.stdout.trim();
      const push = await runner("git", ["push", "-u", "origin", branchName], {
        cwd: context.cwd,
      });

      if (push.code !== 0) {
        return commandFailureResult(push, "git push failed");
      }

      return { status: "passed" };
    },
  };
}

export const pushBackend = createPushBackend();
