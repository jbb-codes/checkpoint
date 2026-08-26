import { mkdirSync } from "node:fs";
import { startDaemon } from "./server.js";
import { checkpointDir, defaultDbPath, defaultSocketPath } from "./paths.js";

mkdirSync(checkpointDir(), { recursive: true });
await startDaemon({ socketPath: defaultSocketPath(), dbPath: defaultDbPath() });
