import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../../src/config/load.js";

describe("loadConfig", () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("returns an empty config when neither global nor repo file exists", async () => {
    dir = mkdtempSync(join(tmpdir(), "checkpoint-config-test-"));
    const globalPath = join(dir, "config.yaml");
    const repoPath = join(dir, ".checkpoint.yaml");

    const config = await loadConfig({ globalPath, repoPath });

    expect(config).toEqual({});
  });

  it("reads the global config when only it exists", async () => {
    dir = mkdtempSync(join(tmpdir(), "checkpoint-config-test-"));
    const globalPath = join(dir, "config.yaml");
    const repoPath = join(dir, ".checkpoint.yaml");
    writeFileSync(
      globalPath,
      "stages:\n  test:\n    backend: /global/test-backend.js\n",
    );

    const config = await loadConfig({ globalPath, repoPath });

    expect(config).toEqual({
      stages: { test: { backend: "/global/test-backend.js" } },
    });
  });

  it("merges the repo override on top of the global config, per stage", async () => {
    dir = mkdtempSync(join(tmpdir(), "checkpoint-config-test-"));
    const globalPath = join(dir, "config.yaml");
    const repoPath = join(dir, ".checkpoint.yaml");
    writeFileSync(
      globalPath,
      "stages:\n  test:\n    backend: /global/test-backend.js\n  lint:\n    backend: /global/lint-backend.js\n",
    );
    writeFileSync(
      repoPath,
      "stages:\n  test:\n    backend: /repo/test-backend.js\n",
    );

    const config = await loadConfig({ globalPath, repoPath });

    expect(config).toEqual({
      stages: {
        test: { backend: "/repo/test-backend.js" },
        lint: { backend: "/global/lint-backend.js" },
      },
    });
  });

  it("rejects a config file that fails schema validation", async () => {
    dir = mkdtempSync(join(tmpdir(), "checkpoint-config-test-"));
    const globalPath = join(dir, "config.yaml");
    const repoPath = join(dir, ".checkpoint.yaml");
    writeFileSync(globalPath, "stages:\n  test:\n    backend: 42\n");

    await expect(loadConfig({ globalPath, repoPath })).rejects.toThrow();
  });
});
