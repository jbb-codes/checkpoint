import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  rmSync,
  readFileSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "yaml";
import { writeDefaultGlobalConfig } from "../../src/init/config.js";
import { configSchema } from "../../src/config/schema.js";

describe("writeDefaultGlobalConfig", () => {
  let dir: string;
  let configPath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "checkpoint-init-test-"));
    configPath = join(dir, "config.yaml");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("writes a config file that parses as a valid, empty-stages config", () => {
    writeDefaultGlobalConfig(configPath);

    expect(existsSync(configPath)).toBe(true);
    const parsed: unknown = parse(readFileSync(configPath, "utf-8"));
    expect(() => configSchema.parse(parsed ?? {})).not.toThrow();
  });

  it("does not overwrite an existing config file", () => {
    writeFileSync(configPath, "stages:\n  lint:\n    backend: ./custom.mjs\n");

    writeDefaultGlobalConfig(configPath);

    expect(readFileSync(configPath, "utf-8")).toContain("custom.mjs");
  });
});
