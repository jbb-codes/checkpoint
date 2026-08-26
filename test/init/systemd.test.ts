import { describe, expect, it } from "vitest";
import {
  generateSystemdSocketUnit,
  generateSystemdServiceUnit,
  SYSTEMD_UNIT_NAME,
} from "../../src/init/systemd.js";

describe("generateSystemdSocketUnit", () => {
  it("listens on the daemon's unix socket path", () => {
    const unit = generateSystemdSocketUnit({
      socketPath: "/home/tester/.checkpoint/daemon.sock",
    });

    expect(unit).toContain("[Socket]");
    expect(unit).toContain("ListenStream=/home/tester/.checkpoint/daemon.sock");
    expect(unit).toContain(`[Install]`);
    expect(unit).toContain(`WantedBy=sockets.target`);
  });
});

describe("generateSystemdServiceUnit", () => {
  it("points ExecStart at the daemon entry and requires the paired socket unit", () => {
    const unit = generateSystemdServiceUnit({
      execPath: "/usr/bin/node",
      daemonEntry: "/home/tester/checkpoint/dist/daemon/index.js",
    });

    expect(unit).toContain(
      "ExecStart=/usr/bin/node /home/tester/checkpoint/dist/daemon/index.js",
    );
    expect(unit).toContain(`Requires=${SYSTEMD_UNIT_NAME}.socket`);
  });
});
