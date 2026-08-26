import { defaultSocketPath } from "../daemon/paths.js";
import { connectWithRetry } from "../daemon/client.js";
import type { DaemonEvent, StatusResponse } from "../protocol/messages.js";

type RunEvent = Exclude<DaemonEvent, StatusResponse>;

function describe(event: RunEvent): string {
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

        const event = JSON.parse(line) as RunEvent;
        console.log(describe(event));
        if (event.type === "outcome") {
          socket.end();
        }
      }
    });
    socket.on("close", () => resolve());
    socket.on("error", reject);
    socket.write(JSON.stringify({ type: "run", cwd: process.cwd() }) + "\n");
  });
}
