import { describe, expect, it } from "vitest";
import { createTestBackend } from "../../../src/stages/backends/test.js";
import type { CommandRunner } from "../../../src/stages/exec.js";

describe("createTestBackend", () => {
  it("passes when the test command exits 0", async () => {
    const runner: CommandRunner = async () => ({
      code: 0,
      stdout: "5 passed",
      stderr: "",
    });
    const backend = createTestBackend(runner);

    const result = await backend.run({ runId: "run-1", cwd: "/repo" });

    expect(result.status).toBe("passed");
  });

  it("fails and reports a finding when the test command exits non-zero", async () => {
    const runner: CommandRunner = async () => ({
      code: 1,
      stdout: "",
      stderr: "1 failing: expected true to be false",
    });
    const backend = createTestBackend(runner);

    const result = await backend.run({ runId: "run-1", cwd: "/repo" });

    expect(result.status).toBe("failed");
    expect(result.findings).toEqual([
      {
        id: expect.any(String),
        description: "1 failing: expected true to be false",
        severity: "error",
        action: "no-op",
      },
    ]);
  });

  it("invokes npm test in the stage's working directory", async () => {
    const calls: Array<{ command: string; args: string[]; cwd: string }> = [];
    const runner: CommandRunner = async (command, args, options) => {
      calls.push({ command, args, cwd: options.cwd });
      return { code: 0, stdout: "", stderr: "" };
    };
    const backend = createTestBackend(runner);

    await backend.run({ runId: "run-1", cwd: "/repo" });

    expect(calls).toEqual([
      { command: "npm", args: ["test", "--silent"], cwd: "/repo" },
    ]);
  });
});
