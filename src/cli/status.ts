import { defaultSocketPath } from "../daemon/paths.js";
import { connectWithRetry } from "../daemon/client.js";
import type { DaemonEvent, RunSummary } from "../protocol/messages.js";

function describeRun(run: RunSummary): string {
  return `${run.id}  ${run.repo}  ${run.status}`;
}

export async function statusCommand(): Promise<void> {
  const socket = await connectWithRetry(defaultSocketPath());
  let buffer = "";

  await new Promise<void>((resolve, reject) => {
    socket.on("data", (chunk) => {
      buffer += chunk.toString();
      const newlineIndex = buffer.indexOf("\n");
      if (newlineIndex === -1) return;
      const line = buffer.slice(0, newlineIndex);

      const event = JSON.parse(line) as DaemonEvent;
      if (event.type === "status_response") {
        if (event.runs.length === 0) {
          console.log("no runs yet");
        } else {
          for (const run of event.runs) {
            console.log(describeRun(run));
          }
        }
        socket.end();
      }
    });
    socket.on("close", () => resolve());
    socket.on("error", reject);
    socket.write(JSON.stringify({ type: "status" }) + "\n");
  });
}
