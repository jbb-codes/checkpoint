import { connect, type Socket } from "node:net";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { defaultSocketPath } from "../daemon/paths.js";
import type { DaemonEvent } from "../protocol/messages.js";

const RETRY_DELAY_MS = 100;
const MAX_RETRIES = 30;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function tryConnect(socketPath: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = connect(socketPath);
    socket.once("connect", () => resolve(socket));
    socket.once("error", reject);
  });
}

function spawnDaemon(): void {
  const daemonEntry = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "daemon",
    "index.js",
  );
  const child = spawn(process.execPath, [daemonEntry], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}

async function connectWithRetry(socketPath: string): Promise<Socket> {
  try {
    return await tryConnect(socketPath);
  } catch {
    spawnDaemon();
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      await sleep(RETRY_DELAY_MS);
      try {
        return await tryConnect(socketPath);
      } catch {
        continue;
      }
    }
    throw new Error(
      "checkpoint: could not connect to daemon after starting it",
    );
  }
}

function describe(event: DaemonEvent): string {
  switch (event.type) {
    case "stage_started":
      return `[${event.stage}] started`;
    case "stage_finished":
      return `[${event.stage}] ${event.status}`;
    case "outcome":
      return `run ${event.runId}: ${event.status}`;
  }
}

export async function runCommand(): Promise<void> {
  const socket = await connectWithRetry(defaultSocketPath());
  let buffer = "";

  await new Promise<void>((resolve, reject) => {
    socket.on("data", (chunk) => {
      buffer += chunk.toString();
      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        if (line.length === 0) continue;

        const event = JSON.parse(line) as DaemonEvent;
        console.log(describe(event));
        if (event.type === "outcome") {
          socket.end();
        }
      }
    });
    socket.on("close", () => resolve());
    socket.on("error", reject);
    socket.write(JSON.stringify({ type: "run" }) + "\n");
  });
}
