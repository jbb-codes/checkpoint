import { existsSync, readFileSync } from "node:fs";
import { parse } from "yaml";
import { configSchema, type Config } from "./schema.js";

export interface LoadConfigOptions {
  globalPath: string;
  repoPath?: string;
}

function readConfigFile(path: string | undefined): Config {
  if (!path || !existsSync(path)) return {};
  const parsed: unknown = parse(readFileSync(path, "utf-8"));
  return configSchema.parse(parsed ?? {});
}

export async function loadConfig(options: LoadConfigOptions): Promise<Config> {
  const global = readConfigFile(options.globalPath);
  const repo = readConfigFile(options.repoPath);

  const stages = { ...global.stages, ...repo.stages };
  return Object.keys(stages).length > 0 ? { stages } : {};
}
