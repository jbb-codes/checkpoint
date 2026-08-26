import { defaultSocketPath } from "../daemon/paths.js";
import { connectWithRetry } from "../daemon/client.js";

export async function abortCommand(runId: string): Promise<void> {
  const socket = await connectWithRetry(defaultSocketPath());
  socket.write(JSON.stringify({ type: "abort", runId }) + "\n");
  socket.end();
  console.log(`checkpoint: abort sent for run ${runId}`);
}
