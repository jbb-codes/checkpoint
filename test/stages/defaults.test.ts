import { describe, expect, it } from "vitest";
import { getDefaultBackend } from "../../src/stages/defaults.js";
import { stubBackend } from "../../src/stages/stub.js";
import { STAGE_ORDER } from "../../src/stages/types.js";

describe("getDefaultBackend", () => {
  it.each(STAGE_ORDER)(
    "returns a real, non-stub backend for the %s stage",
    (stage) => {
      const backend = getDefaultBackend(stage);
      expect(backend).not.toBe(stubBackend);
      expect(typeof backend.run).toBe("function");
    },
  );
});
