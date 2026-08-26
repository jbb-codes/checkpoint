import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { connect } from "node:net";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
    return collectEventsWithCwd(dir);
  }

  function collectEventsWithCwd(cwd: string): Promise<DaemonEvent[]> {
    return new Promise((resolve, reject) => {
      const events: DaemonEvent[] = [];
      const socket = connect(socketPath);
      let buffer = "";

      socket.on("connect", () => {
        socket.write(JSON.stringify({ type: "run", cwd }) + "\n");
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

  function fetchStatus(): Promise<DaemonEvent> {
    return new Promise((resolve, reject) => {
      const socket = connect(socketPath);
      let buffer = "";

      socket.on("connect", () => {
        socket.write(JSON.stringify({ type: "status" }) + "\n");
      });

      socket.on("data", (chunk) => {
        buffer += chunk.toString();
        const newlineIndex = buffer.indexOf("\n");
        if (newlineIndex === -1) return;
        const line = buffer.slice(0, newlineIndex);
        const message = JSON.parse(line) as DaemonEvent;
        socket.end();
        resolve(message);
      });

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

  it("passes the requesting client's cwd to stage backends, not the daemon's own", async () => {
    const capturedCwdPath = join(dir, "captured-cwd.json");
    const cwdCapturingBackendPath = join(dir, "cwd-capturing-backend.mjs");
    writeFileSync(
      cwdCapturingBackendPath,
      `import { writeFileSync } from "node:fs";
       export default { run: async (ctx) => {
         writeFileSync(${JSON.stringify(capturedCwdPath)}, JSON.stringify(ctx.cwd));
         return { status: "passed" };
       } };`,
    );
    const config: Config = {
      stages: { intent: { backend: cwdCapturingBackendPath } },
    };
    daemon = await startDaemon({ socketPath, dbPath, config });

    const clientCwd = join(dir, "some", "other", "worktree");
    await collectEventsWithCwd(clientCwd);

    const captured = JSON.parse(
      readFileSync(capturedCwdPath, "utf8"),
    ) as string;
    expect(captured).toBe(clientCwd);
  });

  it("reports runs from multiple repos/worktrees through the same daemon's status", async () => {
    daemon = await startDaemon({ socketPath, dbPath, config: {} });

    const repoA = join(dir, "repo-a");
    const repoB = join(dir, "repo-b");
    await collectEventsWithCwd(repoA);
    await collectEventsWithCwd(repoB);

    const response = await fetchStatus();
    if (response.type !== "status_response") {
      throw new Error("expected status_response");
    }

    const repos = response.runs.map((run) => run.repo).sort();
    expect(repos).toEqual([repoA, repoB].sort());
    expect(response.runs.every((run) => run.status === "passed")).toBe(true);
  });
});
