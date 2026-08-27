import { defaultCommandRunner, type CommandRunner } from "../exec.js";
import type { StageBackend } from "../types.js";
import { createFinding } from "./finding.js";

const DEFAULT_BASE_BRANCH = "main";

async function detectBaseBranch(
  runner: CommandRunner,
  cwd: string,
): Promise<string> {
  const result = await runner(
    "git",
    ["symbolic-ref", "refs/remotes/origin/HEAD"],
    { cwd },
  );
  const ref = result.stdout.trim();
  const prefix = "refs/remotes/origin/";
  if (result.code === 0 && ref.startsWith(prefix)) {
    return ref.slice(prefix.length);
  }
  return DEFAULT_BASE_BRANCH;
}

export function createRebaseBackend(
  runner: CommandRunner = defaultCommandRunner,
): StageBackend {
  return {
    async run(context) {
      const base = await detectBaseBranch(runner, context.cwd);
      const remoteBase = `origin/${base}`;

      await runner("git", ["fetch", "origin", base], { cwd: context.cwd });

      const isAncestor = await runner(
        "git",
        ["merge-base", "--is-ancestor", remoteBase, "HEAD"],
        { cwd: context.cwd },
      );
      if (isAncestor.code === 0) {
        return { status: "passed" };
      }

      const rebase = await runner("git", ["rebase", remoteBase], {
        cwd: context.cwd,
      });
      if (rebase.code === 0) {
        return { status: "passed" };
      }

      await runner("git", ["rebase", "--abort"], { cwd: context.cwd });
      return {
        status: "failed",
        findings: [
          createFinding({
            description:
              rebase.stderr.trim() ||
              rebase.stdout.trim() ||
              `rebase onto ${remoteBase} failed with conflicts`,
            severity: "error",
            action: "ask-user",
          }),
        ],
      };
    },
  };
}

export const rebaseBackend = createRebaseBackend();
