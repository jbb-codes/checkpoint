import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadStageBackend } from "../../src/stages/loader.js";

describe("loadStageBackend", () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("dynamically imports a script path whose default export satisfies StageBackend", async () => {
    dir = mkdtempSync(join(tmpdir(), "checkpoint-loader-test-"));
    const scriptPath = join(dir, "backend.mjs");
    writeFileSync(
      scriptPath,
      `export default { run: async () => ({ status: "passed" }) };`,
    );

    const backend = await loadStageBackend(scriptPath);
    const result = await backend.run({ runId: "run-1", cwd: dir });

    expect(result.status).toBe("passed");
  });

  it("throws when the module's default export has no run function", async () => {
    dir = mkdtempSync(join(tmpdir(), "checkpoint-loader-test-"));
    const scriptPath = join(dir, "bad-backend.mjs");
    writeFileSync(scriptPath, `export default { notRun: true };`);

    await expect(loadStageBackend(scriptPath)).rejects.toThrow(/StageBackend/);
  });
});
