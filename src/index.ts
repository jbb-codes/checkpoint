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
import { respondCommand } from "./cli/respond.js";
import { abortCommand } from "./cli/abort.js";
import type { RespondAction } from "./protocol/messages.js";
import { defaultGlobalConfigPath, defaultSocketPath } from "./daemon/paths.js";

const execFileAsync = promisify(execFile);
const RESPOND_ACTIONS: RespondAction[] = ["approve", "skip", "fix"];

function isRespondAction(value: string | undefined): value is RespondAction {
  return RESPOND_ACTIONS.includes(value as RespondAction);
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);

  switch (command) {
    case "run": {
      const intentIndex = args.indexOf("--intent");
      const intent = intentIndex === -1 ? undefined : args[intentIndex + 1];
      await runCommand(intent);
      break;
    }
    case "status":
      await statusCommand();
      break;
    case "respond": {
      const [runId, action, findingIds] = args;
      if (!runId || !isRespondAction(action)) {
        console.error(
          "checkpoint: usage: checkpoint respond <runId> <approve|skip|fix> [findingId1,findingId2]",
        );
        process.exitCode = 1;
        break;
      }
      await respondCommand({
        runId,
        action,
        findingIds: findingIds ? findingIds.split(",") : undefined,
      });
      break;
    }
    case "abort": {
      const [runId] = args;
      if (!runId) {
        console.error("checkpoint: usage: checkpoint abort <runId>");
        process.exitCode = 1;
        break;
      }
      await abortCommand(runId);
      break;
    }
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
