import { describe, expect, it } from "vitest";
import { createIntentBackend } from "../../../src/stages/backends/intent.js";

describe("createIntentBackend", () => {
  it("passes when intent is provided", async () => {
    const backend = createIntentBackend();

    const result = await backend.run({
      runId: "run-1",
      cwd: "/repo",
      intent: "add dark mode toggle",
    });

    expect(result.status).toBe("passed");
    expect(result.findings).toBeUndefined();
  });

  it("fails and asks the user when intent is missing", async () => {
    const backend = createIntentBackend();

    const result = await backend.run({ runId: "run-1", cwd: "/repo" });

    expect(result.status).toBe("failed");
    expect(result.findings).toEqual([
      {
        id: expect.any(String),
        description: expect.stringContaining("intent"),
        severity: "error",
        action: "ask-user",
      },
    ]);
  });

  it("fails when intent is an empty or whitespace-only string", async () => {
    const backend = createIntentBackend();

    const result = await backend.run({
      runId: "run-1",
      cwd: "/repo",
      intent: "   ",
    });

    expect(result.status).toBe("failed");
  });
});
