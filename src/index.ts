#!/usr/bin/env node

import { runCommand } from "./cli/run.js";

async function main(): Promise<void> {
  const [command] = process.argv.slice(2);

  switch (command) {
    case "run":
      await runCommand();
      break;
    default:
      console.log("checkpoint: nothing to validate yet");
  }
}

await main();
