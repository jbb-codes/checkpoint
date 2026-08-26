import { describe, expect, it } from "vitest";
import {
  resolveActivationFd,
  resolveListenTarget,
} from "../../src/daemon/activation.js";

describe("resolveActivationFd", () => {
  it("returns undefined when no activation env vars are set", () => {
    expect(resolveActivationFd({})).toBeUndefined();
  });

  it("returns fd 3 when systemd's LISTEN_FDS/LISTEN_PID protocol matches this process", () => {
    const fd = resolveActivationFd(
      { LISTEN_FDS: "1", LISTEN_PID: String(process.pid) },
      process.pid,
    );
    expect(fd).toBe(3);
  });

  it("ignores LISTEN_FDS when LISTEN_PID does not match this process", () => {
    const fd = resolveActivationFd(
      { LISTEN_FDS: "1", LISTEN_PID: "1" },
      process.pid,
    );
    expect(fd).toBeUndefined();
  });

  it("returns fd 3 when our launchd activation flag is set", () => {
    const fd = resolveActivationFd({ CHECKPOINT_SOCKET_ACTIVATED: "1" });
    expect(fd).toBe(3);
  });
});

describe("resolveListenTarget", () => {
  it("targets the unix socket path when there is no activation fd", () => {
    expect(resolveListenTarget("/tmp/daemon.sock", undefined)).toBe(
      "/tmp/daemon.sock",
    );
  });

  it("targets the pre-bound fd when the OS handed one over via socket activation", () => {
    expect(resolveListenTarget("/tmp/daemon.sock", 3)).toEqual({ fd: 3 });
  });
});
