import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { connect, createServer, type Server } from "node:net";
import { mkdtempSync, openSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startDaemon, type Daemon } from "../../src/daemon/server.js";
import type { DaemonEvent } from "../../src/protocol/messages.js";
import type { Config } from "../../src/config/schema.js";

const MINIMAL_CONFIG: Config = { stages: {} };

describe("startDaemon launchd activation", () => {
  let dir: string;
  let socketPath: string;
  let dbPath: string;
  let daemon: Daemon | undefined;
  let preboundServer: Server | undefined;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "checkpoint-activation-test-"));
    socketPath = join(dir, "daemon.sock");
    dbPath = join(dir, "state.db");
  });

  afterEach(async () => {
    delete process.env.CHECKPOINT_SOCKET_ACTIVATED;
    await daemon?.close();
    preboundServer?.close();
    rmSync(dir, { recursive: true, force: true });
  });

  function fetchStatus(): Promise<DaemonEvent> {
    return new Promise((resolve, reject) => {
      const socket = connect(socketPath);
      let buffer = "";

      socket.on("connect", () => {
        socket.write(JSON.stringify({ type: "status" }) + "\n");
      });

      socket.on("data", (chunk: Buffer) => {
        buffer += chunk.toString();
        const newlineIndex = buffer.indexOf("\n");
        if (newlineIndex === -1) return;
        const line = buffer.slice(0, newlineIndex);
        socket.end();
        resolve(JSON.parse(line) as DaemonEvent);
      });

      socket.on("error", reject);
    });
  }

  it("self-binds over an already-listening launchd fd without crashing with ENOTTY", async () => {
    // Simulate what launchd hands the process: a real Unix domain socket at
    // the daemon's socket path that is already bound AND listening, owned by
    // a process we don't control. We dup the fd (as fd inheritance across
    // exec would) rather than hand over our only reference to it, so
    // closeSync in startDaemon releases just our copy instead of tearing
    // down the listening socket itself.
    preboundServer = createServer();
    await new Promise<void>((resolve, reject) => {
      preboundServer?.once("error", reject);
      preboundServer?.listen(socketPath, () => { resolve(); });
    });
    const originalFd = (
      preboundServer as unknown as { _handle: { fd: number } }
    )._handle.fd;
    const activatedFd = openSync(`/dev/fd/${originalFd}`, "r+");

    process.env.CHECKPOINT_SOCKET_ACTIVATED = "1";

    daemon = await startDaemon({
      socketPath,
      dbPath,
      config: MINIMAL_CONFIG,
      activatedFd,
    });

    const response = await fetchStatus();
    expect(response).toEqual({ type: "status_response", runs: [] });
  });
});
