import { describe, expect, it } from "vitest";
import { getDefaultBackend } from "../../src/stages/defaults.js";
import { stubBackend } from "../../src/stages/stub.js";

describe("getDefaultBackend", () => {
  it.each(["review", "test", "lint", "push", "PR", "CI"] as const)(
    "returns a real, non-stub backend for the %s stage",
    (stage) => {
      const backend = getDefaultBackend(stage);
      expect(backend).not.toBe(stubBackend);
      expect(typeof backend.run).toBe("function");
    },
  );

  it.each(["intent", "rebase", "document"] as const)(
    "falls back to the stub backend for the %s stage",
    (stage) => {
      expect(getDefaultBackend(stage)).toBe(stubBackend);
    },
  );
});
