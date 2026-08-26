import { createServer, type Server, type Socket } from "node:net";
import { randomUUID } from "node:crypto";
import { unlinkSync, existsSync } from "node:fs";
import { openRunStore, type RunStore } from "../state/db.js";
import type {
  ClientRequest,
  DaemonEvent,
  RespondAction,
} from "../protocol/messages.js";
import type { Config } from "../config/schema.js";
import { STAGE_ORDER } from "../stages/types.js";
import { loadStageBackend } from "../stages/loader.js";
import { stubBackend } from "../stages/stub.js";
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

interface GateResponse {
  action: RespondAction;
  findingIds?: string[];
}

interface RunState {
  socket: Socket;
  aborted: boolean;
  resolveGate?: (response: GateResponse) => void;
}

function send(socket: Socket, event: DaemonEvent): void {
  socket.write(JSON.stringify(event) + "\n");
}

async function runPipeline(
  runId: string,
  cwd: string,
  store: RunStore,
  config: Config,
  registry: Map<string, RunState>,
): Promise<void> {
  const state = registry.get(runId);
  if (!state) return;

  for (const stage of STAGE_ORDER) {
    if (state.aborted) break;

    const backendPath = config.stages?.[stage]?.backend;
    const backend = backendPath
      ? await loadStageBackend(backendPath)
      : stubBackend;

    send(state.socket, { type: "stage_started", runId, stage });
    const result = await backend.run({ runId, cwd });

    if (state.aborted) break;

    const askUserFindings = (result.findings ?? []).filter(
      (finding) => finding.action === "ask-user",
    );

    if (askUserFindings.length > 0) {
      store.markRunGated(runId);
      send(state.socket, {
        type: "gate_hit",
        runId,
        stage,
        findings: result.findings ?? [],
      });

      const response = await new Promise<GateResponse>((resolve) => {
        state.resolveGate = resolve;
      });
      state.resolveGate = undefined;

      if (state.aborted) break;

      if (response.action === "approve") {
        send(state.socket, {
          type: "stage_finished",
          runId,
          stage,
          status: result.status,
        });
        if (result.status === "failed") {
          store.finishRun(runId, "failed", new Date().toISOString());
          send(state.socket, { type: "outcome", runId, status: "failed" });
          registry.delete(runId);
          return;
        }
      } else {
        // "skip" or "fix": the gated finding is resolved without failing the run.
        send(state.socket, {
          type: "stage_finished",
          runId,
          stage,
          status: "passed",
        });
      }
      continue;
    }

    send(state.socket, {
      type: "stage_finished",
      runId,
      stage,
      status: result.status,
    });

    if (result.status === "failed") {
      store.finishRun(runId, "failed", new Date().toISOString());
      send(state.socket, { type: "outcome", runId, status: "failed" });
      registry.delete(runId);
      return;
    }
  }

  if (state.aborted) {
    store.finishRun(runId, "aborted", new Date().toISOString());
    send(state.socket, { type: "outcome", runId, status: "aborted" });
    registry.delete(runId);
    return;
  }

  store.finishRun(runId, "passed", new Date().toISOString());
  send(state.socket, { type: "outcome", runId, status: "passed" });
  registry.delete(runId);
}

function handleConnection(
  socket: Socket,
  store: RunStore,
  config: Config,
  registry: Map<string, RunState>,
): void {
  let buffer = "";

  socket.on("data", (chunk: Buffer) => {
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
        registry.set(runId, { socket, aborted: false });
        void runPipeline(runId, request.cwd, store, config, registry);
      } else if (request.type === "status") {
        send(socket, { type: "status_response", runs: store.listRuns() });
      } else if (request.type === "respond") {
        const state = registry.get(request.runId);
        state?.resolveGate?.({
          action: request.action,
          findingIds: request.findingIds,
        });
      } else if (request.type === "abort") {
        const state = registry.get(request.runId);
        if (state) {
          state.aborted = true;
          state.resolveGate?.({ action: "approve" });
        }
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

  const registry = new Map<string, RunState>();

  const server: Server = createServer((socket) => {
    idle?.connectionOpened();
    socket.on("close", () => idle?.connectionClosed());
    handleConnection(socket, store, options.config, registry);
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
