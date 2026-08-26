import { describe, expect, it } from "vitest";
import { createReviewBackend } from "../../../src/stages/backends/review.js";
import type { CommandRunner } from "../../../src/stages/exec.js";

describe("createReviewBackend", () => {
  it("passes when there are no changed files", async () => {
    const runner: CommandRunner = async () => ({
      code: 0,
      stdout: "",
      stderr: "",
    });
    const backend = createReviewBackend(runner, () => "");

    const result = await backend.run({ runId: "run-1", cwd: "/repo" });

    expect(result.status).toBe("passed");
    expect(result.findings).toBeUndefined();
  });

  it("flags console.log statements in changed files", async () => {
    const runner: CommandRunner = async () => ({
      code: 0,
      stdout: "src/index.ts\n",
      stderr: "",
    });
    const readFile = () => "const x = 1;\nconsole.log(x);\n";
    const backend = createReviewBackend(runner, readFile);

    const result = await backend.run({ runId: "run-1", cwd: "/repo" });

    expect(result.status).toBe("failed");
    expect(result.findings).toEqual([
      {
        file: "src/index.ts",
        line: 2,
        message: "console.log/debug statement found",
        severity: "error",
      },
    ]);
  });

  it("flags hardcoded secrets in changed files", async () => {
    const runner: CommandRunner = async () => ({
      code: 0,
      stdout: "src/config.ts\n",
      stderr: "",
    });
    const fakeSecretLine = [
      "const",
      "token",
      "=",
      '"placeholder-' + "value123" + '";',
    ].join(" ");
    const readFile = () => `${fakeSecretLine}\n`;
    const backend = createReviewBackend(runner, readFile);

    const result = await backend.run({ runId: "run-1", cwd: "/repo" });

    expect(result.status).toBe("failed");
    expect(result.findings).toEqual([
      {
        file: "src/config.ts",
        line: 1,
        message: "possible hardcoded secret",
        severity: "error",
      },
    ]);
  });

  it("skips files it cannot read without failing the stage", async () => {
    const runner: CommandRunner = async () => ({
      code: 0,
      stdout: "deleted-file.ts\n",
      stderr: "",
    });
    const readFile = () => {
      throw new Error("ENOENT");
    };
    const backend = createReviewBackend(runner, readFile);

    const result = await backend.run({ runId: "run-1", cwd: "/repo" });

    expect(result.status).toBe("passed");
  });
});
