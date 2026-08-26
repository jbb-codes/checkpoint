import { mkdirSync } from "node:fs";
import { startDaemon } from "./server.js";
import {
  checkpointDir,
  defaultDbPath,
  defaultGlobalConfigPath,
  defaultRepoConfigPath,
  defaultSocketPath,
} from "./paths.js";
import { loadConfig } from "../config/load.js";

mkdirSync(checkpointDir(), { recursive: true });
const config = await loadConfig({
  globalPath: defaultGlobalConfigPath(),
  repoPath: defaultRepoConfigPath(process.cwd()),
});
await startDaemon({
  socketPath: defaultSocketPath(),
  dbPath: defaultDbPath(),
  config,
});
