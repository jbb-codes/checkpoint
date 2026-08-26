#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { runCommand } from "./cli/run.js";
import { statusCommand } from "./cli/status.js";
import { initCommand } from "./cli/init.js";
import { defaultGlobalConfigPath, defaultSocketPath } from "./daemon/paths.js";

const execFileAsync = promisify(execFile);

async function main(): Promise<void> {
  const [command] = process.argv.slice(2);

  switch (command) {
    case "run":
      await runCommand();
      break;
    case "status":
      await statusCommand();
      break;
    case "init":
      await initCommand({
        platform: process.platform,
        homeDir: homedir(),
        execPath: process.execPath,
        daemonEntry: join(
          dirname(fileURLToPath(import.meta.url)),
          "daemon",
          "index.js",
        ),
        globalConfigPath: defaultGlobalConfigPath(),
        socketPath: defaultSocketPath(),
        writeServiceFile(path, content) {
          mkdirSync(dirname(path), { recursive: true });
          writeFileSync(path, content);
        },
        async runCommand(cmd, args) {
          await execFileAsync(cmd, args);
        },
      });
      console.log("checkpoint: initialized");
      break;
    default:
      console.log("checkpoint: nothing to validate yet");
  }
}

await main();
