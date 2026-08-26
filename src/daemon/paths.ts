import { homedir } from "node:os";
import { join } from "node:path";

const CHECKPOINT_DIR = join(homedir(), ".checkpoint");

export function defaultSocketPath(): string {
  return join(CHECKPOINT_DIR, "daemon.sock");
}

export function defaultDbPath(): string {
  return join(CHECKPOINT_DIR, "state.db");
}

export function checkpointDir(): string {
  return CHECKPOINT_DIR;
}

export function defaultGlobalConfigPath(): string {
  return join(CHECKPOINT_DIR, "config.yaml");
}

export function defaultRepoConfigPath(cwd: string): string {
  return join(cwd, ".checkpoint.yaml");
}
