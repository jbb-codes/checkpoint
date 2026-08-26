import { describe, expect, it } from "vitest";
import { createLintBackend } from "../../../src/stages/backends/lint.js";
import type { CommandRunner } from "../../../src/stages/exec.js";

const ESLINT_JSON_WITH_ISSUES = JSON.stringify([
  {
    filePath: "/repo/src/index.ts",
    messages: [
      { line: 3, message: "Unexpected console statement.", severity: 2 },
      { line: 10, message: "Unused variable 'x'.", severity: 1 },
    ],
  },
]);

describe("createLintBackend", () => {
  it("passes with no findings when eslint reports no messages", async () => {
    const runner: CommandRunner = async () => ({
      code: 0,
      stdout: JSON.stringify([
        { filePath: "/repo/src/index.ts", messages: [] },
      ]),
      stderr: "",
    });
    const backend = createLintBackend(runner);

    const result = await backend.run({ runId: "run-1", cwd: "/repo" });

    expect(result.status).toBe("passed");
    expect(result.findings).toBeUndefined();
  });

  it("fails and maps eslint messages to findings when errors are reported", async () => {
    const runner: CommandRunner = async () => ({
      code: 1,
      stdout: ESLINT_JSON_WITH_ISSUES,
      stderr: "",
    });
    const backend = createLintBackend(runner);

    const result = await backend.run({ runId: "run-1", cwd: "/repo" });

    expect(result.status).toBe("failed");
    expect(result.findings).toEqual([
      {
        file: "/repo/src/index.ts",
        line: 3,
        message: "Unexpected console statement.",
        severity: "error",
      },
      {
        file: "/repo/src/index.ts",
        line: 10,
        message: "Unused variable 'x'.",
        severity: "warning",
      },
    ]);
  });

  it("treats a missing eslint config (exit code 2) as passed with no findings", async () => {
    const runner: CommandRunner = async () => ({
      code: 2,
      stdout: "",
      stderr: "ESLint couldn't find a configuration file.",
    });
    const backend = createLintBackend(runner);

    const result = await backend.run({ runId: "run-1", cwd: "/repo" });

    expect(result.status).toBe("passed");
    expect(result.findings).toBeUndefined();
  });

  it("never passes a formatting flag like --fix — lint only verifies", async () => {
    const calls: string[][] = [];
    const runner: CommandRunner = async (command, args) => {
      calls.push([command, ...args]);
      return { code: 0, stdout: "[]", stderr: "" };
    };
    const backend = createLintBackend(runner);

    await backend.run({ runId: "run-1", cwd: "/repo" });

    expect(calls[0]).not.toContain("--fix");
  });
});
