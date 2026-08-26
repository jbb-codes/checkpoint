import { describe, expect, it } from "vitest";
import { createCiBackend } from "../../../src/stages/backends/ci.js";
import type { CommandRunner } from "../../../src/stages/exec.js";

describe("createCiBackend", () => {
  it("passes when gh pr checks --watch exits 0", async () => {
    const calls: string[][] = [];
    const runner: CommandRunner = async (command, args) => {
      calls.push([command, ...args]);
      return { code: 0, stdout: "All checks were successful", stderr: "" };
    };
    const backend = createCiBackend(runner);

    const result = await backend.run({ runId: "run-1", cwd: "/repo" });

    expect(result.status).toBe("passed");
    expect(calls).toEqual([["gh", "pr", "checks", "--watch"]]);
  });

  it("fails and reports a finding when checks fail", async () => {
    const runner: CommandRunner = async () => ({
      code: 1,
      stdout: "",
      stderr: "Some checks were not successful",
    });
    const backend = createCiBackend(runner);

    const result = await backend.run({ runId: "run-1", cwd: "/repo" });

    expect(result.status).toBe("failed");
    expect(result.findings).toEqual([
      { message: "Some checks were not successful", severity: "error" },
    ]);
  });
});
