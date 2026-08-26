import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { connect, type Socket } from "node:net";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { startDaemon, type Daemon } from "../../src/daemon/server.js";
import type { DaemonEvent } from "../../src/protocol/messages.js";
import type { Config } from "../../src/config/schema.js";
import type { StageName } from "../../src/stages/types.js";

function writeBackend(path: string, body: string): void {
  writeFileSync(path, `export default { run: async () => (${body}) };`);
}

const REAL_DEFAULT_STAGES = [
  "test",
  "lint",
  "push",
  "PR",
  "CI",
] as const satisfies readonly StageName[];

describe("gate/respond flow", () => {
  let dir: string;
  let socketPath: string;
  let dbPath: string;
  let daemon: Daemon;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "checkpoint-gate-test-"));
    socketPath = join(dir, "daemon.sock");
    dbPath = join(dir, "state.db");
  });

  afterEach(async () => {
    await daemon.close();
    rmSync(dir, { recursive: true, force: true });
  });

  function writeInstantBackend(): string {
    const backendPath = join(dir, `instant-backend-${randomUUID()}.mjs`);
    writeBackend(backendPath, `{ status: "passed" }`);
    return backendPath;
  }

  function withStubbedDefaults(config: Config): Config {
    const stages: Config["stages"] = { ...config.stages };
    for (const stage of REAL_DEFAULT_STAGES) {
      if (!stages[stage]) {
        stages[stage] = { backend: writeInstantBackend() };
      }
    }
    return { stages };
  }

  function connectSocket(): Promise<Socket> {
    return new Promise((resolve, reject) => {
      const socket = connect(socketPath);
      socket.once("connect", () => resolve(socket));
      socket.once("error", reject);
    });
  }

  function readEvents(
    socket: Socket,
    onEvent: (event: DaemonEvent) => void,
  ): void {
    let buffer = "";
    socket.on("data", (chunk) => {
      buffer += chunk.toString();
      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        if (line.length === 0) continue;
        onEvent(JSON.parse(line) as DaemonEvent);
      }
    });
  }

  function send(socket: Socket, message: unknown): void {
    socket.write(JSON.stringify(message) + "\n");
  }

  function waitFor(
    events: DaemonEvent[],
    predicate: (event: DaemonEvent) => boolean,
  ): Promise<DaemonEvent> {
    return new Promise((resolve) => {
      const existing = events.find(predicate);
      if (existing) {
        resolve(existing);
        return;
      }
      const interval = setInterval(() => {
        const found = events.find(predicate);
        if (found) {
          clearInterval(interval);
          resolve(found);
        }
      }, 5);
    });
  }

  async function fetchStatus(): Promise<
    Extract<DaemonEvent, { type: "status_response" }>
  > {
    const socket = await connectSocket();
    return new Promise((resolve) => {
      readEvents(socket, (event) => {
        if (event.type === "status_response") {
          socket.end();
          resolve(event);
        }
      });
      send(socket, { type: "status" });
    });
  }

  it("proceeds without stopping when a stage only has auto-fix/no-op findings", async () => {
    const backendPath = join(dir, "review-backend.mjs");
    writeBackend(
      backendPath,
      `{
        status: "passed",
        findings: [
          { id: "f1", severity: "info", description: "unused import", action: "auto-fix" },
          { id: "f2", severity: "info", description: "fyi", action: "no-op" },
        ],
      }`,
    );
    const config = withStubbedDefaults({
      stages: { review: { backend: backendPath } },
    });
    daemon = await startDaemon({ socketPath, dbPath, config });

    const socket = await connectSocket();
    const events: DaemonEvent[] = [];
    readEvents(socket, (event) => {
      events.push(event);
      if (event.type === "outcome") socket.end();
    });
    send(socket, { type: "run", cwd: dir });

    const outcome = await waitFor(events, (event) => event.type === "outcome");
    if (outcome.type !== "outcome") throw new Error("expected outcome");
    expect(outcome.status).toBe("passed");
    expect(events.some((event) => event.type === "gate_hit")).toBe(false);
  });

  it("halts with gate_hit when a stage has an ask-user finding, until respond is called", async () => {
    const backendPath = join(dir, "review-backend.mjs");
    writeBackend(
      backendPath,
      `{
        status: "passed",
        findings: [
          { id: "f1", severity: "warning", description: "risky change", action: "ask-user" },
        ],
      }`,
    );
    const config = withStubbedDefaults({
      stages: { review: { backend: backendPath } },
    });
    daemon = await startDaemon({ socketPath, dbPath, config });

    const socket = await connectSocket();
    const events: DaemonEvent[] = [];
    readEvents(socket, (event) => {
      events.push(event);
      if (event.type === "outcome") socket.end();
    });
    send(socket, { type: "run", cwd: dir });

    const gateEvent = await waitFor(
      events,
      (event) => event.type === "gate_hit",
    );
    if (gateEvent.type !== "gate_hit") throw new Error("expected gate_hit");
    expect(gateEvent.stage).toBe("review");
    expect(gateEvent.findings).toHaveLength(1);
    expect(gateEvent.findings[0].action).toBe("ask-user");

    // pipeline should not have finished yet
    expect(events.some((event) => event.type === "outcome")).toBe(false);

    const status = await fetchStatus();
    expect(status.runs[0].status).toBe("gated");

    send(socket, {
      type: "respond",
      runId: gateEvent.runId,
      action: "approve",
    });

    const outcome = await waitFor(events, (event) => event.type === "outcome");
    if (outcome.type !== "outcome") throw new Error("expected outcome");
    expect(outcome.status).toBe("passed");
  });

  it("supports fixing specific findings by id via respond", async () => {
    const backendPath = join(dir, "review-backend.mjs");
    writeBackend(
      backendPath,
      `{
        status: "passed",
        findings: [
          { id: "f1", severity: "warning", description: "risky change", action: "ask-user" },
        ],
      }`,
    );
    const config = withStubbedDefaults({
      stages: { review: { backend: backendPath } },
    });
    daemon = await startDaemon({ socketPath, dbPath, config });

    const socket = await connectSocket();
    const events: DaemonEvent[] = [];
    readEvents(socket, (event) => {
      events.push(event);
      if (event.type === "outcome") socket.end();
    });
    send(socket, { type: "run", cwd: dir });

    const gateEvent = await waitFor(
      events,
      (event) => event.type === "gate_hit",
    );
    if (gateEvent.type !== "gate_hit") throw new Error("expected gate_hit");

    send(socket, {
      type: "respond",
      runId: gateEvent.runId,
      action: "fix",
      findingIds: ["f1"],
    });

    const outcome = await waitFor(events, (event) => event.type === "outcome");
    if (outcome.type !== "outcome") throw new Error("expected outcome");
    expect(outcome.status).toBe("passed");
  });

  it("supports skipping the gated step via respond", async () => {
    const backendPath = join(dir, "review-backend.mjs");
    writeBackend(
      backendPath,
      `{
        status: "passed",
        findings: [
          { id: "f1", severity: "warning", description: "risky change", action: "ask-user" },
        ],
      }`,
    );
    const config = withStubbedDefaults({
      stages: { review: { backend: backendPath } },
    });
    daemon = await startDaemon({ socketPath, dbPath, config });

    const socket = await connectSocket();
    const events: DaemonEvent[] = [];
    readEvents(socket, (event) => {
      events.push(event);
      if (event.type === "outcome") socket.end();
    });
    send(socket, { type: "run", cwd: dir });

    const gateEvent = await waitFor(
      events,
      (event) => event.type === "gate_hit",
    );
    if (gateEvent.type !== "gate_hit") throw new Error("expected gate_hit");

    send(socket, { type: "respond", runId: gateEvent.runId, action: "skip" });

    const outcome = await waitFor(events, (event) => event.type === "outcome");
    if (outcome.type !== "outcome") throw new Error("expected outcome");
    expect(outcome.status).toBe("passed");
  });

  it("cancels an active/gated run via abort, reflected in both the daemon and SQLite", async () => {
    const backendPath = join(dir, "review-backend.mjs");
    writeBackend(
      backendPath,
      `{
        status: "passed",
        findings: [
          { id: "f1", severity: "warning", description: "risky change", action: "ask-user" },
        ],
      }`,
    );
    const config = withStubbedDefaults({
      stages: { review: { backend: backendPath } },
    });
    daemon = await startDaemon({ socketPath, dbPath, config });

    const socket = await connectSocket();
    const events: DaemonEvent[] = [];
    readEvents(socket, (event) => {
      events.push(event);
      if (event.type === "outcome") socket.end();
    });
    send(socket, { type: "run", cwd: dir });

    const gateEvent = await waitFor(
      events,
      (event) => event.type === "gate_hit",
    );
    if (gateEvent.type !== "gate_hit") throw new Error("expected gate_hit");

    const abortSocket = await connectSocket();
    send(abortSocket, { type: "abort", runId: gateEvent.runId });
    abortSocket.end();

    const outcome = await waitFor(events, (event) => event.type === "outcome");
    if (outcome.type !== "outcome") throw new Error("expected outcome");
    expect(outcome.status).toBe("aborted");

    const db = new Database(dbPath, { readonly: true });
    const row = db
      .prepare("SELECT status FROM runs WHERE id = ?")
      .get(gateEvent.runId) as { status: string } | undefined;
    db.close();
    expect(row?.status).toBe("aborted");
  });
});
