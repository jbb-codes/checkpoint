#!/usr/bin/env node

import { runCommand } from "./cli/run.js";
import { statusCommand } from "./cli/status.js";

async function main(): Promise<void> {
  const [command] = process.argv.slice(2);

  switch (command) {
    case "run":
      await runCommand();
      break;
    case "status":
      await statusCommand();
      break;
    default:
      console.log("checkpoint: nothing to validate yet");
  }
}

await main();
