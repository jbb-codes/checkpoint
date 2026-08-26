import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initCommand } from "../../src/cli/init.js";
import { LAUNCHD_LABEL } from "../../src/init/launchd.js";
import { SYSTEMD_UNIT_NAME } from "../../src/init/systemd.js";

describe("initCommand", () => {
  let dir: string;
  let globalConfigPath: string;
  let socketPath: string;
  let writeServiceFile: ReturnType<typeof vi.fn>;
  let runCommand: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "checkpoint-init-cli-test-"));
    globalConfigPath = join(dir, "config.yaml");
    socketPath = join(dir, "daemon.sock");
    writeServiceFile = vi.fn();
    runCommand = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("always writes the default global config, regardless of platform", async () => {
    await initCommand({
      platform: "win32",
      homeDir: dir,
      execPath: "/usr/bin/node",
      daemonEntry: "/x/dist/daemon/index.js",
      globalConfigPath,
      socketPath,
      writeServiceFile,
      runCommand,
    });

    expect(existsSync(globalConfigPath)).toBe(true);
  });

  it("on darwin, writes a launchd plist and bootstraps it with launchctl", async () => {
    await initCommand({
      platform: "darwin",
      homeDir: dir,
      execPath: "/usr/bin/node",
      daemonEntry: "/x/dist/daemon/index.js",
      globalConfigPath,
      socketPath,
      writeServiceFile,
      runCommand,
    });

    const [plistPath, plistContent] = writeServiceFile.mock.calls[0] as [
      string,
      string,
    ];
    expect(plistPath).toContain("Library/LaunchAgents");
    expect(plistPath).toContain(`${LAUNCHD_LABEL}.plist`);
    expect(plistContent).toContain(socketPath);

    expect(runCommand).toHaveBeenCalledWith(
      "launchctl",
      expect.arrayContaining(["bootstrap"]),
    );
  });

  it("on linux, writes systemd socket+service units and enables the socket unit", async () => {
    await initCommand({
      platform: "linux",
      homeDir: dir,
      execPath: "/usr/bin/node",
      daemonEntry: "/x/dist/daemon/index.js",
      globalConfigPath,
      socketPath,
      writeServiceFile,
      runCommand,
    });

    const writtenPaths = writeServiceFile.mock.calls.map(
      (call) => call[0] as string,
    );
    expect(writtenPaths).toEqual(
      expect.arrayContaining([
        expect.stringContaining(`${SYSTEMD_UNIT_NAME}.socket`),
        expect.stringContaining(`${SYSTEMD_UNIT_NAME}.service`),
      ]),
    );

    expect(runCommand).toHaveBeenCalledWith(
      "systemctl",
      expect.arrayContaining(["--user", "daemon-reload"]),
    );
    expect(runCommand).toHaveBeenCalledWith(
      "systemctl",
      expect.arrayContaining([
        "--user",
        "enable",
        "--now",
        `${SYSTEMD_UNIT_NAME}.socket`,
      ]),
    );
  });

  it("on win32, does not install any OS service (lazy-start unchanged)", async () => {
    await initCommand({
      platform: "win32",
      homeDir: dir,
      execPath: "/usr/bin/node",
      daemonEntry: "/x/dist/daemon/index.js",
      globalConfigPath,
      socketPath,
      writeServiceFile,
      runCommand,
    });

    expect(writeServiceFile).not.toHaveBeenCalled();
    expect(runCommand).not.toHaveBeenCalled();
  });
});
