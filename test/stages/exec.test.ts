import { describe, expect, it } from "vitest";
import { defaultCommandRunner } from "../../src/stages/exec.js";

describe("defaultCommandRunner", () => {
  it("resolves with exit code 0 and captured stdout on success", async () => {
    const result = await defaultCommandRunner(
      "node",
      ["-e", "console.log('hello')"],
      { cwd: process.cwd() },
    );

    expect(result.code).toBe(0);
    expect(result.stdout.trim()).toBe("hello");
  });

  it("resolves with a non-zero exit code and captured stderr on failure", async () => {
    const result = await defaultCommandRunner(
      "node",
      ["-e", "console.error('boom'); process.exit(2)"],
      { cwd: process.cwd() },
    );

    expect(result.code).toBe(2);
    expect(result.stderr.trim()).toBe("boom");
  });
});
