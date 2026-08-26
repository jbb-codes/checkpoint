import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { connect } from "node:net";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { startDaemon, type Daemon } from "../../src/daemon/server.js";
import type { DaemonEvent } from "../../src/protocol/messages.js";

describe("daemon single-stage run", () => {
  let dir: string;
  let socketPath: string;
  let dbPath: string;
  let daemon: Daemon;

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), "checkpoint-test-"));
    socketPath = join(dir, "daemon.sock");
    dbPath = join(dir, "state.db");
    daemon = await startDaemon({ socketPath, dbPath });
  });

  afterEach(async () => {
    await daemon.close();
    rmSync(dir, { recursive: true, force: true });
  });

  function collectEvents(): Promise<DaemonEvent[]> {
    return new Promise((resolve, reject) => {
      const events: DaemonEvent[] = [];
      const socket = connect(socketPath);
      let buffer = "";

      socket.on("connect", () => {
        socket.write(JSON.stringify({ type: "run" }) + "\n");
      });

      socket.on("data", (chunk) => {
        buffer += chunk.toString();
        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (line.length === 0) continue;
          const message = JSON.parse(line) as DaemonEvent;
          events.push(message);
          if (message.type === "outcome") {
            socket.end();
          }
        }
      });

      socket.on("close", () => resolve(events));
      socket.on("error", reject);
    });
  }

  it("streams stage_started, stage_finished, then outcome over the socket", async () => {
    const events = await collectEvents();

    expect(events.map((event) => event.type)).toEqual([
      "stage_started",
      "stage_finished",
      "outcome",
    ]);

    const outcome = events[2];
    if (outcome.type !== "outcome") throw new Error("expected outcome");
    expect(outcome.status).toBe("passed");
  });

  it("persists the run to SQLite with id, status, and timestamps", async () => {
    const events = await collectEvents();
    const outcome = events[2];
    if (outcome.type !== "outcome") throw new Error("expected outcome");

    const db = new Database(dbPath, { readonly: true });
    const row = db
      .prepare(
        "SELECT id, status, started_at, finished_at FROM runs WHERE id = ?",
      )
      .get(outcome.runId) as
      | { id: string; status: string; started_at: string; finished_at: string }
      | undefined;
    db.close();

    expect(row).toBeDefined();
    expect(row?.status).toBe("passed");
    expect(row?.started_at).toBeTruthy();
    expect(row?.finished_at).toBeTruthy();
  });
});
