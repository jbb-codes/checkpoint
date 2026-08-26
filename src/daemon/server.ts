import { createServer, type Server, type Socket } from "node:net";
import { randomUUID } from "node:crypto";
import { unlinkSync, existsSync } from "node:fs";
import { openRunStore, type RunStore } from "../state/db.js";
import type { ClientRequest, DaemonEvent } from "../protocol/messages.js";
import type { Config } from "../config/schema.js";
import { STAGE_ORDER } from "../stages/types.js";
import { loadStageBackend } from "../stages/loader.js";
import { getDefaultBackend } from "../stages/defaults.js";
import { resolveActivationFd, resolveListenTarget } from "./activation.js";
import { startIdleShutdown } from "./idle-shutdown.js";

const IDLE_SHUTDOWN_MS = 10 * 60 * 1000;

export interface DaemonOptions {
  socketPath: string;
  dbPath: string;
  config: Config;
}

export interface Daemon {
  close(): Promise<void>;
}

function send(socket: Socket, event: DaemonEvent): void {
  socket.write(JSON.stringify(event) + "\n");
}

async function runPipeline(
  runId: string,
  cwd: string,
  socket: Socket,
  store: RunStore,
  config: Config,
): Promise<void> {
  for (const stage of STAGE_ORDER) {
    const backendPath = config.stages?.[stage]?.backend;
    const backend = backendPath
      ? await loadStageBackend(backendPath)
      : getDefaultBackend(stage);

    send(socket, { type: "stage_started", runId, stage });
    const result = await backend.run({ runId, cwd });
    send(socket, {
      type: "stage_finished",
      runId,
      stage,
      status: result.status,
    });

    if (result.status === "failed") {
      store.finishRun(runId, "failed", new Date().toISOString());
      send(socket, { type: "outcome", runId, status: "failed" });
      return;
    }
  }

  store.finishRun(runId, "passed", new Date().toISOString());
  send(socket, { type: "outcome", runId, status: "passed" });
}

function handleConnection(
  socket: Socket,
  store: RunStore,
  config: Config,
): void {
  let buffer = "";

  socket.on("data", (chunk) => {
    buffer += chunk.toString();
    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      if (line.length === 0) continue;

      const request = JSON.parse(line) as ClientRequest;
      if (request.type === "run") {
        const runId = randomUUID();
        store.createRun(runId, request.cwd, new Date().toISOString());
        void runPipeline(runId, request.cwd, socket, store, config);
      } else if (request.type === "status") {
        send(socket, { type: "status_response", runs: store.listRuns() });
      }
    }
  });
}

export function startDaemon(options: DaemonOptions): Promise<Daemon> {
  const store = openRunStore(options.dbPath);
  store.markInterruptedRunsFailed(new Date().toISOString());

  const activationFd = resolveActivationFd(process.env);
  if (activationFd === undefined && existsSync(options.socketPath)) {
    unlinkSync(options.socketPath);
  }

  const idle =
    activationFd === undefined
      ? undefined
      : startIdleShutdown(() => {
          void close().then(() => process.exit(0));
        }, IDLE_SHUTDOWN_MS);

  const server: Server = createServer((socket) => {
    idle?.connectionOpened();
    socket.on("close", () => idle?.connectionClosed());
    handleConnection(socket, store, options.config);
  });

  function close(): Promise<void> {
    idle?.dispose();
    store.close();
    return new Promise((closeResolve) => server.close(() => closeResolve()));
  }

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(resolveListenTarget(options.socketPath, activationFd), () => {
      server.removeListener("error", reject);
      resolve({ close });
    });
  });
}
