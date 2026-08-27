import { createServer, type Server, type Socket } from "node:net";
import { randomUUID } from "node:crypto";
import { closeSync, unlinkSync, existsSync } from "node:fs";
import { openRunStore, type RunStore } from "../state/db.js";
import {
  clientRequestSchema,
  type DaemonEvent,
  type RespondAction,
} from "../protocol/messages.js";
import { createLineReader } from "../protocol/framing.js";
import type { Config } from "../config/schema.js";
import { STAGE_ORDER, type StageName } from "../stages/types.js";
import type { StageBackend, StageResult } from "../stages/types.js";
import { loadStageBackend } from "../stages/loader.js";
import { getDefaultBackend } from "../stages/defaults.js";
import { resolveActivation, resolveListenTarget } from "./activation.js";
import { startIdleShutdown } from "./idle-shutdown.js";

const IDLE_SHUTDOWN_MS = 10 * 60 * 1000;

export interface DaemonOptions {
  socketPath: string;
  dbPath: string;
  config: Config;
  /**
   * Overrides the fd number read for OS-managed socket activation. Tests use
   * this to inject a real pre-bound fd without remapping the process's
   * actual fd 3.
   */
  activatedFd?: number;
}

export interface Daemon {
  close(): Promise<void>;
}

interface GateResponse {
  action: RespondAction;
  findingIds?: string[];
}

interface RunState {
  readonly socket: Socket;
  readonly aborted: boolean;
  readonly resolveGate?: (response: GateResponse) => void;
}

function send(socket: Socket, event: DaemonEvent): void {
  socket.write(JSON.stringify(event) + "\n");
}

function patchRunState(
  registry: Map<string, RunState>,
  runId: string,
  patch: Partial<RunState>,
): void {
  const current = registry.get(runId);
  if (!current) return;
  registry.set(runId, { ...current, ...patch });
}

function isAborted(registry: Map<string, RunState>, runId: string): boolean {
  return registry.get(runId)?.aborted ?? false;
}

function finishRun(
  runId: string,
  status: "passed" | "failed" | "aborted",
  socket: Socket,
  store: RunStore,
  registry: Map<string, RunState>,
): void {
  store.finishRun(runId, status, new Date().toISOString());
  send(socket, { type: "outcome", runId, status });
  registry.delete(runId);
}

async function resolveStageBackend(
  stage: StageName,
  config: Config,
): Promise<StageBackend> {
  const backendPath = config.stages?.[stage]?.backend;
  return backendPath
    ? await loadStageBackend(backendPath)
    : getDefaultBackend(stage);
}

async function waitForGateResponse(
  runId: string,
  registry: Map<string, RunState>,
): Promise<GateResponse> {
  const response = await new Promise<GateResponse>((resolve) => {
    patchRunState(registry, runId, { resolveGate: resolve });
  });
  patchRunState(registry, runId, { resolveGate: undefined });
  return response;
}

async function handleGateHit(
  runId: string,
  stage: StageName,
  result: StageResult,
  socket: Socket,
  store: RunStore,
  registry: Map<string, RunState>,
): Promise<"aborted" | "failed" | "continue"> {
  store.markRunGated(runId);
  send(socket, {
    type: "gate_hit",
    runId,
    stage,
    findings: result.findings ?? [],
  });

  const response = await waitForGateResponse(runId, registry);

  if (isAborted(registry, runId)) return "aborted";

  if (response.action === "approve") {
    send(socket, {
      type: "stage_finished",
      runId,
      stage,
      status: result.status,
    });
    return result.status === "failed" ? "failed" : "continue";
  }

  // "skip" or "fix": the gated finding is resolved without failing the run.
  send(socket, { type: "stage_finished", runId, stage, status: "passed" });
  return "continue";
}

async function runPipeline(
  runId: string,
  cwd: string,
  intent: string,
  store: RunStore,
  config: Config,
  registry: Map<string, RunState>,
): Promise<void> {
  const initial = registry.get(runId);
  if (!initial) return;
  const socket = initial.socket;

  for (const stage of STAGE_ORDER) {
    if (isAborted(registry, runId)) break;

    const backend = await resolveStageBackend(stage, config);

    send(socket, { type: "stage_started", runId, stage });
    const result = await backend.run({ runId, cwd, intent });

    if (isAborted(registry, runId)) break;

    const askUserFindings = (result.findings ?? []).filter(
      (finding) => finding.action === "ask-user",
    );

    if (askUserFindings.length > 0) {
      const outcome = await handleGateHit(
        runId,
        stage,
        result,
        socket,
        store,
        registry,
      );
      if (outcome === "aborted" || outcome === "failed") {
        finishRun(runId, outcome, socket, store, registry);
        return;
      }
      continue;
    }

    send(socket, {
      type: "stage_finished",
      runId,
      stage,
      status: result.status,
    });

    if (result.status === "failed") {
      finishRun(runId, "failed", socket, store, registry);
      return;
    }
  }

  if (isAborted(registry, runId)) {
    finishRun(runId, "aborted", socket, store, registry);
    return;
  }

  finishRun(runId, "passed", socket, store, registry);
}

function handleConnection(
  socket: Socket,
  store: RunStore,
  config: Config,
  registry: Map<string, RunState>,
): void {
  const onLine = createLineReader((line) => {
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(line);
    } catch {
      console.error(
        "checkpoint: dropping malformed client message (invalid JSON)",
      );
      return;
    }

    const parsed = clientRequestSchema.safeParse(parsedJson);
    if (!parsed.success) {
      console.error(
        `checkpoint: dropping malformed client message: ${parsed.error.message}`,
      );
      return;
    }
    const request = parsed.data;

    if (request.type === "run") {
      const runId = randomUUID();
      store.createRun(runId, request.cwd, new Date().toISOString());
      registry.set(runId, { socket, aborted: false });
      void runPipeline(
        runId,
        request.cwd,
        request.intent ?? "",
        store,
        config,
        registry,
      );
    } else if (request.type === "status") {
      send(socket, { type: "status_response", runs: store.listRuns() });
    } else if (request.type === "respond") {
      const state = registry.get(request.runId);
      state?.resolveGate?.({
        action: request.action,
        findingIds: request.findingIds,
      });
    } else {
      const state = registry.get(request.runId);
      state?.resolveGate?.({ action: "approve" });
      patchRunState(registry, request.runId, {
        aborted: true,
        resolveGate: undefined,
      });
    }
  });

  socket.on("data", onLine);
}

export function startDaemon(options: DaemonOptions): Promise<Daemon> {
  const store = openRunStore(options.dbPath);
  store.markInterruptedRunsFailed(new Date().toISOString());

  const activation = resolveActivation(
    process.env,
    process.pid,
    options.activatedFd,
  );

  // launchd hands over a socket that's already bound AND listening; Node's
  // listen({fd}) fails trying to listen() it a second time (ENOTTY on
  // macOS, see issue #9). Release our copy of that fd and self-bind fresh
  // at the same path instead, same as the plain lazy-start path.
  if (activation?.kind === "launchd") {
    closeSync(activation.fd);
  }

  const selfBinds = activation === undefined || activation.kind === "launchd";
  if (selfBinds && existsSync(options.socketPath)) {
    unlinkSync(options.socketPath);
  }

  const idle =
    activation === undefined
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
    return new Promise((closeResolve) =>
      server.close(() => {
        closeResolve();
      }),
    );
  }

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(resolveListenTarget(options.socketPath, activation), () => {
      server.removeListener("error", reject);
      resolve({ close });
    });
  });
}
