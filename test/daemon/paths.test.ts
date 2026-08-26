import { describe, expect, it } from "vitest";
import { defaultSocketPath, checkpointDir } from "../../src/daemon/paths.js";

describe("defaultSocketPath", () => {
  it("returns a Windows named pipe path on win32", () => {
    expect(defaultSocketPath("win32")).toBe("\\\\.\\pipe\\checkpoint-daemon");
  });

  it("returns a Unix domain socket path under the checkpoint dir on posix platforms", () => {
    expect(defaultSocketPath("linux")).toBe(`${checkpointDir()}/daemon.sock`);
    expect(defaultSocketPath("darwin")).toBe(`${checkpointDir()}/daemon.sock`);
  });

  it("defaults to the current process platform when none is given", () => {
    const expected =
      process.platform === "win32"
        ? "\\\\.\\pipe\\checkpoint-daemon"
        : `${checkpointDir()}/daemon.sock`;
    expect(defaultSocketPath()).toBe(expected);
  });
});
