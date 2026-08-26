import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { connect } from "node:net";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { startDaemon, type Daemon } from "../../src/daemon/server.js";
import type { DaemonEvent } from "../../src/protocol/messages.js";
import { STAGE_ORDER } from "../../src/stages/types.js";
import type { Config } from "../../src/config/schema.js";

describe("daemon pipeline run", () => {
  let dir: string;
  let socketPath: string;
  let dbPath: string;
  let daemon: Daemon;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "checkpoint-test-"));
    socketPath = join(dir, "daemon.sock");
    dbPath = join(dir, "state.db");
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

  it("runs all 9 stages in fixed order using the built-in stub backend", async () => {
    daemon = await startDaemon({ socketPath, dbPath, config: {} });

    const events = await collectEvents();

    const startedStages = events
      .filter((event) => event.type === "stage_started")
      .map((event) => event.stage);
    const finishedStages = events
      .filter((event) => event.type === "stage_finished")
      .map((event) => event.stage);

    expect(startedStages).toEqual([...STAGE_ORDER]);
    expect(finishedStages).toEqual([...STAGE_ORDER]);

    const outcome = events[events.length - 1];
    if (outcome.type !== "outcome") throw new Error("expected outcome");
    expect(outcome.status).toBe("passed");
  });

  it("persists the run to SQLite with id, status, and timestamps", async () => {
    daemon = await startDaemon({ socketPath, dbPath, config: {} });
    const events = await collectEvents();
    const outcome = events[events.length - 1];
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

  it("loads a stage's backend from config and stops the pipeline when it fails", async () => {
    const failingBackendPath = join(dir, "failing-lint-backend.mjs");
    writeFileSync(
      failingBackendPath,
      `export default { run: async () => ({ status: "failed" }) };`,
    );
    const config: Config = {
      stages: { lint: { backend: failingBackendPath } },
    };
    daemon = await startDaemon({ socketPath, dbPath, config });

    const events = await collectEvents();

    const startedStages = events
      .filter((event) => event.type === "stage_started")
      .map((event) => event.stage);
    const finishedStages = events
      .filter((event) => event.type === "stage_finished")
      .map((event) => event.stage);

    const lintIndex = STAGE_ORDER.indexOf("lint");
    expect(startedStages).toEqual(STAGE_ORDER.slice(0, lintIndex + 1));
    expect(finishedStages).toEqual(STAGE_ORDER.slice(0, lintIndex + 1));

    const outcome = events[events.length - 1];
    if (outcome.type !== "outcome") throw new Error("expected outcome");
    expect(outcome.status).toBe("failed");
  });
});
