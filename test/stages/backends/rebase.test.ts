import { describe, expect, it } from "vitest";
import { createRebaseBackend } from "../../../src/stages/backends/rebase.js";
import type { CommandRunner } from "../../../src/stages/exec.js";

function commandOf(call: { command: string; args: string[] }): string {
  return `${call.command} ${call.args.join(" ")}`;
}

describe("createRebaseBackend", () => {
  it("passes without rebasing when already up to date with the detected base branch", async () => {
    const calls: { command: string; args: string[] }[] = [];
    const runner: CommandRunner = async (command, args) => {
      calls.push({ command, args });
      if (args[0] === "symbolic-ref") {
        return { code: 0, stdout: "refs/remotes/origin/main\n", stderr: "" };
      }
      if (args[0] === "fetch") {
        return { code: 0, stdout: "", stderr: "" };
      }
      if (args[0] === "merge-base") {
        return { code: 0, stdout: "", stderr: "" }; // is-ancestor: already up to date
      }
      throw new Error(`unexpected command: ${commandOf({ command, args })}`);
    };
    const backend = createRebaseBackend(runner);

    const result = await backend.run({ runId: "run-1", cwd: "/repo" });

    expect(result.status).toBe("passed");
    expect(calls.map(commandOf)).not.toContain("git rebase origin/main");
  });

  it("rebases onto the detected base branch when behind", async () => {
    const calls: { command: string; args: string[] }[] = [];
    const runner: CommandRunner = async (command, args) => {
      calls.push({ command, args });
      if (args[0] === "symbolic-ref") {
        return { code: 0, stdout: "refs/remotes/origin/main\n", stderr: "" };
      }
      if (args[0] === "fetch") {
        return { code: 0, stdout: "", stderr: "" };
      }
      if (args[0] === "merge-base") {
        return { code: 1, stdout: "", stderr: "" }; // is-ancestor: behind
      }
      if (args[0] === "rebase") {
        return { code: 0, stdout: "", stderr: "" };
      }
      throw new Error(`unexpected command: ${commandOf({ command, args })}`);
    };
    const backend = createRebaseBackend(runner);

    const result = await backend.run({ runId: "run-1", cwd: "/repo" });

    expect(result.status).toBe("passed");
    expect(calls.map(commandOf)).toContain("git rebase origin/main");
  });

  it("falls back to main when the remote default branch can't be detected", async () => {
    const calls: { command: string; args: string[] }[] = [];
    const runner: CommandRunner = async (command, args) => {
      calls.push({ command, args });
      if (args[0] === "symbolic-ref") {
        return { code: 128, stdout: "", stderr: "not a symbolic ref" };
      }
      if (args[0] === "fetch") {
        return { code: 0, stdout: "", stderr: "" };
      }
      if (args[0] === "merge-base") {
        return { code: 0, stdout: "", stderr: "" };
      }
      throw new Error(`unexpected command: ${commandOf({ command, args })}`);
    };
    const backend = createRebaseBackend(runner);

    const result = await backend.run({ runId: "run-1", cwd: "/repo" });

    expect(result.status).toBe("passed");
    expect(calls.some((call) => call.args.includes("origin/main"))).toBe(true);
  });

  it("aborts the rebase and asks the user when conflicts occur", async () => {
    const calls: { command: string; args: string[] }[] = [];
    const runner: CommandRunner = async (command, args) => {
      calls.push({ command, args });
      if (args[0] === "symbolic-ref") {
        return { code: 0, stdout: "refs/remotes/origin/main\n", stderr: "" };
      }
      if (args[0] === "fetch") {
        return { code: 0, stdout: "", stderr: "" };
      }
      if (args[0] === "merge-base") {
        return { code: 1, stdout: "", stderr: "" };
      }
      if (args[0] === "rebase" && args[1] === "--abort") {
        return { code: 0, stdout: "", stderr: "" };
      }
      if (args[0] === "rebase") {
        return { code: 1, stdout: "", stderr: "CONFLICT in src/index.ts" };
      }
      throw new Error(`unexpected command: ${commandOf({ command, args })}`);
    };
    const backend = createRebaseBackend(runner);

    const result = await backend.run({ runId: "run-1", cwd: "/repo" });

    expect(result.status).toBe("failed");
    expect(result.findings).toEqual([
      {
        id: expect.any(String),
        description: "CONFLICT in src/index.ts",
        severity: "error",
        action: "ask-user",
      },
    ]);
    expect(calls.map(commandOf)).toContain("git rebase --abort");
  });
});
