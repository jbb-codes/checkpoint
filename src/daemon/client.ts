import { connect, type Socket } from "node:net";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

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
  const daemonEntry = join(dirname(fileURLToPath(import.meta.url)), "index.js");
  const child = spawn(process.execPath, [daemonEntry], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}

export async function connectWithRetry(socketPath: string): Promise<Socket> {
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
