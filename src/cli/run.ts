import { defaultSocketPath } from "../daemon/paths.js";
import { connectWithRetry } from "../daemon/client.js";
import { runEventSchema, type RunEvent } from "../protocol/messages.js";
import { createLineReader } from "../protocol/framing.js";

function describe(event: RunEvent): string {
  switch (event.type) {
    case "stage_started":
      return `[${event.stage}] started`;
    case "stage_finished":
      return `[${event.stage}] ${event.status}`;
    case "gate_hit":
      return `[${event.stage}] gated: ${event.findings
        .map((finding) => `${finding.id} ${finding.description}`)
        .join(
          "; ",
        )} — run "checkpoint respond ${event.runId} <approve|skip|fix> [ids]"`;
    case "outcome":
      return `run ${event.runId}: ${event.status}`;
  }
}

export async function runCommand(): Promise<void> {
  const socket = await connectWithRetry(defaultSocketPath());

  await new Promise<void>((resolve, reject) => {
    const onLine = createLineReader((line) => {
      const event = runEventSchema.parse(JSON.parse(line));
      console.log(describe(event));
      if (event.type === "outcome") {
        socket.end();
      }
    });
    socket.on("data", onLine);
    socket.on("close", () => {
      resolve();
    });
    socket.on("error", reject);
    socket.write(JSON.stringify({ type: "run", cwd: process.cwd() }) + "\n");
  });
}
