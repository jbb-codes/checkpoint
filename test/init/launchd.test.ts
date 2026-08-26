import { describe, expect, it } from "vitest";
import { generateLaunchdPlist, LAUNCHD_LABEL } from "../../src/init/launchd.js";

describe("generateLaunchdPlist", () => {
  it("declares socket activation on the daemon's unix socket path", () => {
    const plist = generateLaunchdPlist({
      socketPath: "/Users/tester/.checkpoint/daemon.sock",
      execPath: "/usr/local/bin/node",
      daemonEntry: "/Users/tester/checkpoint/dist/daemon/index.js",
    });

    expect(plist).toContain(`<key>Label</key>`);
    expect(plist).toContain(LAUNCHD_LABEL);
    expect(plist).toContain(`<key>SockPathName</key>`);
    expect(plist).toContain(
      `<string>/Users/tester/.checkpoint/daemon.sock</string>`,
    );
    expect(plist).toContain(`<key>Sockets</key>`);
  });

  it("sets the activation flag env var and points ProgramArguments at the daemon entry", () => {
    const plist = generateLaunchdPlist({
      socketPath: "/x/daemon.sock",
      execPath: "/usr/bin/node",
      daemonEntry: "/x/dist/daemon/index.js",
    });

    expect(plist).toContain(`<key>CHECKPOINT_SOCKET_ACTIVATED</key>`);
    expect(plist).toContain(`<string>/usr/bin/node</string>`);
    expect(plist).toContain(`<string>/x/dist/daemon/index.js</string>`);
  });

  it("restarts the daemon on crash but does not keep it running when it exits cleanly", () => {
    const plist = generateLaunchdPlist({
      socketPath: "/x/daemon.sock",
      execPath: "/usr/bin/node",
      daemonEntry: "/x/dist/daemon/index.js",
    });

    expect(plist).toContain(`<key>KeepAlive</key>`);
    expect(plist).toContain(`<key>SuccessfulExit</key>`);
    expect(plist).toContain(`<false/>`);
    expect(plist).toContain(`<key>RunAtLoad</key>`);
  });
});
