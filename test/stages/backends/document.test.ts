import { describe, expect, it } from "vitest";
import { createDocumentBackend } from "../../../src/stages/backends/document.js";
import type { CommandRunner } from "../../../src/stages/exec.js";

function runnerWithChangedFiles(files: string[]): CommandRunner {
  return async () => ({ code: 0, stdout: files.join("\n") + "\n", stderr: "" });
}

describe("createDocumentBackend", () => {
  it("passes with no findings when no files changed", async () => {
    const backend = createDocumentBackend(runnerWithChangedFiles([]));

    const result = await backend.run({ runId: "run-1", cwd: "/repo" });

    expect(result.status).toBe("passed");
    expect(result.findings).toBeUndefined();
  });

  it("passes with no findings when only non-source files changed", async () => {
    const backend = createDocumentBackend(
      runnerWithChangedFiles(["test/foo.test.ts", "package.json"]),
    );

    const result = await backend.run({ runId: "run-1", cwd: "/repo" });

    expect(result.status).toBe("passed");
    expect(result.findings).toBeUndefined();
  });

  it("passes with no findings when source and docs both changed", async () => {
    const backend = createDocumentBackend(
      runnerWithChangedFiles(["src/foo.ts", "README.md"]),
    );

    const result = await backend.run({ runId: "run-1", cwd: "/repo" });

    expect(result.status).toBe("passed");
    expect(result.findings).toBeUndefined();
  });

  it("passes with no findings when source and a docs/ file both changed", async () => {
    const backend = createDocumentBackend(
      runnerWithChangedFiles(["src/foo.ts", "docs/adr/0009-thing.md"]),
    );

    const result = await backend.run({ runId: "run-1", cwd: "/repo" });

    expect(result.status).toBe("passed");
    expect(result.findings).toBeUndefined();
  });

  it("surfaces a no-op finding when source changed without any docs update", async () => {
    const backend = createDocumentBackend(
      runnerWithChangedFiles(["src/foo.ts", "src/bar.ts"]),
    );

    const result = await backend.run({ runId: "run-1", cwd: "/repo" });

    expect(result.status).toBe("passed");
    expect(result.findings).toEqual([
      {
        id: expect.any(String),
        description: expect.stringContaining("docs"),
        severity: "info",
        action: "no-op",
      },
    ]);
  });
});
