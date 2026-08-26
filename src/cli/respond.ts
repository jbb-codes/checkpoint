import { defaultSocketPath } from "../daemon/paths.js";
import { connectWithRetry } from "../daemon/client.js";
import type { RespondAction } from "../protocol/messages.js";

export interface RespondOptions {
  runId: string;
  action: RespondAction;
  findingIds?: string[];
}

export async function respondCommand(options: RespondOptions): Promise<void> {
  const socket = await connectWithRetry(defaultSocketPath());
  socket.write(
    JSON.stringify({
      type: "respond",
      runId: options.runId,
      action: options.action,
      findingIds: options.findingIds,
    }) + "\n",
  );
  socket.end();
  console.log(`checkpoint: ${options.action} sent for run ${options.runId}`);
}
