import { describe, expect, it } from "vitest";
import { createPrBackend } from "../../../src/stages/backends/pr.js";
import type { CommandRunner } from "../../../src/stages/exec.js";

describe("createPrBackend", () => {
  it("passes without creating a PR when one already exists", async () => {
    const calls: string[][] = [];
    const runner: CommandRunner = async (command, args) => {
      calls.push([command, ...args]);
      return {
        code: 0,
        stdout: JSON.stringify({ url: "https://github.com/o/r/pull/1" }),
        stderr: "",
      };
    };
    const backend = createPrBackend(runner);

    const result = await backend.run({ runId: "run-1", cwd: "/repo" });

    expect(result.status).toBe("passed");
    expect(result.findings).toEqual([
      {
        id: expect.any(String),
        description: "PR already exists: https://github.com/o/r/pull/1",
        severity: "info",
        action: "no-op",
      },
    ]);
    expect(calls).toEqual([["gh", "pr", "view", "--json", "url"]]);
  });

  it("creates a PR when none exists yet", async () => {
    const calls: string[][] = [];
    const runner: CommandRunner = async (command, args) => {
      calls.push([command, ...args]);
      if (args[1] === "view") {
        return { code: 1, stdout: "", stderr: "no pull requests found" };
      }
      return {
        code: 0,
        stdout: "https://github.com/o/r/pull/2\n",
        stderr: "",
      };
    };
    const backend = createPrBackend(runner);

    const result = await backend.run({ runId: "run-1", cwd: "/repo" });

    expect(result.status).toBe("passed");
    expect(result.findings).toEqual([
      {
        id: expect.any(String),
        description: "https://github.com/o/r/pull/2",
        severity: "info",
        action: "no-op",
      },
    ]);
    expect(calls).toEqual([
      ["gh", "pr", "view", "--json", "url"],
      ["gh", "pr", "create", "--fill"],
    ]);
  });

  it("fails when gh pr create exits non-zero", async () => {
    const runner: CommandRunner = async (_command, args) => {
      if (args[1] === "view") {
        return { code: 1, stdout: "", stderr: "no pull requests found" };
      }
      return {
        code: 1,
        stdout: "",
        stderr: "no commits between main and HEAD",
      };
    };
    const backend = createPrBackend(runner);

    const result = await backend.run({ runId: "run-1", cwd: "/repo" });

    expect(result.status).toBe("failed");
    expect(result.findings).toEqual([
      {
        id: expect.any(String),
        description: "no commits between main and HEAD",
        severity: "error",
        action: "no-op",
      },
    ]);
  });
});
