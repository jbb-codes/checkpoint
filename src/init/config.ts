import { existsSync, writeFileSync } from "node:fs";

const DEFAULT_CONFIG = `# checkpoint global config
# See README.md for available stages and backend options.
stages: {}
`;

export function writeDefaultGlobalConfig(configPath: string): void {
  if (existsSync(configPath)) return;
  writeFileSync(configPath, DEFAULT_CONFIG);
}
