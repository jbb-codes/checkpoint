import { describe, expect, it } from "vitest";
import { createPushBackend } from "../../../src/stages/backends/push.js";
import type { CommandRunner } from "../../../src/stages/exec.js";

describe("createPushBackend", () => {
  it("resolves the current branch and pushes it to origin", async () => {
    const calls: { command: string; args: string[] }[] = [];
    const runner: CommandRunner = async (command, args) => {
      calls.push({ command, args });
      if (args[0] === "rev-parse") {
        return { code: 0, stdout: "feat/my-branch\n", stderr: "" };
      }
      return { code: 0, stdout: "", stderr: "" };
    };
    const backend = createPushBackend(runner);

    const result = await backend.run({ runId: "run-1", cwd: "/repo" });

    expect(result.status).toBe("passed");
    expect(calls).toEqual([
      { command: "git", args: ["rev-parse", "--abbrev-ref", "HEAD"] },
      { command: "git", args: ["push", "-u", "origin", "feat/my-branch"] },
    ]);
  });

  it("fails when the branch cannot be resolved", async () => {
    const runner: CommandRunner = async () => ({
      code: 128,
      stdout: "",
      stderr: "not a git repository",
    });
    const backend = createPushBackend(runner);

    const result = await backend.run({ runId: "run-1", cwd: "/repo" });

    expect(result.status).toBe("failed");
    expect(result.findings).toEqual([
      {
        id: expect.any(String),
        description: "not a git repository",
        severity: "error",
        action: "no-op",
      },
    ]);
  });

  it("fails when git push exits non-zero", async () => {
    const runner: CommandRunner = async (_command, args) => {
      if (args[0] === "rev-parse") {
        return { code: 0, stdout: "main\n", stderr: "" };
      }
      return { code: 1, stdout: "", stderr: "rejected: non-fast-forward" };
    };
    const backend = createPushBackend(runner);

    const result = await backend.run({ runId: "run-1", cwd: "/repo" });

    expect(result.status).toBe("failed");
    expect(result.findings).toEqual([
      {
        id: expect.any(String),
        description: "rejected: non-fast-forward",
        severity: "error",
        action: "no-op",
      },
    ]);
  });
});
