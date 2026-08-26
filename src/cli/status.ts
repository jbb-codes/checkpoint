import { defaultSocketPath } from "../daemon/paths.js";
import { connectWithRetry } from "../daemon/client.js";
import { daemonEventSchema, type RunSummary } from "../protocol/messages.js";
import { createLineReader } from "../protocol/framing.js";

function describeRun(run: RunSummary): string {
  return `${run.id}  ${run.repo}  ${run.status}`;
}

export async function statusCommand(): Promise<void> {
  const socket = await connectWithRetry(defaultSocketPath());

  await new Promise<void>((resolve, reject) => {
    const onLine = createLineReader((line) => {
      const event = daemonEventSchema.parse(JSON.parse(line));
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
    socket.on("data", onLine);
    socket.on("close", () => {
      resolve();
    });
    socket.on("error", reject);
    socket.write(JSON.stringify({ type: "status" }) + "\n");
  });
}
