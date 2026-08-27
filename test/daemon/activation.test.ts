import { describe, expect, it } from "vitest";
import {
  resolveActivation,
  resolveListenTarget,
} from "../../src/daemon/activation.js";

describe("resolveActivation", () => {
  it("returns undefined when no activation env vars are set", () => {
    expect(resolveActivation({})).toBeUndefined();
  });

  it("returns systemd fd 3 when LISTEN_FDS/LISTEN_PID protocol matches this process", () => {
    const activation = resolveActivation(
      { LISTEN_FDS: "1", LISTEN_PID: String(process.pid) },
      process.pid,
    );
    expect(activation).toEqual({ kind: "systemd", fd: 3 });
  });

  it("ignores LISTEN_FDS when LISTEN_PID does not match this process", () => {
    const activation = resolveActivation(
      { LISTEN_FDS: "1", LISTEN_PID: "1" },
      process.pid,
    );
    expect(activation).toBeUndefined();
  });

  it("returns launchd fd 3 when our launchd activation flag is set", () => {
    const activation = resolveActivation({ CHECKPOINT_SOCKET_ACTIVATED: "1" });
    expect(activation).toEqual({ kind: "launchd", fd: 3 });
  });
});

describe("resolveListenTarget", () => {
  it("targets the unix socket path when there is no activation", () => {
    expect(resolveListenTarget("/tmp/daemon.sock", undefined)).toBe(
      "/tmp/daemon.sock",
    );
  });

  it("targets the pre-bound fd when systemd handed one over", () => {
    expect(
      resolveListenTarget("/tmp/daemon.sock", { kind: "systemd", fd: 3 }),
    ).toEqual({ fd: 3 });
  });

  it("targets the socket path (self-bind) when launchd handed one over", () => {
    // launchd's fd is already bound AND listening; Node's server.listen({fd})
    // tries to listen() it a second time, which crashes with ENOTTY on
    // macOS. Self-binding a fresh socket at the same path avoids that path
    // entirely (see issue #9).
    expect(
      resolveListenTarget("/tmp/daemon.sock", { kind: "launchd", fd: 3 }),
    ).toBe("/tmp/daemon.sock");
  });
});
