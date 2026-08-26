import { join } from "node:path";
import { writeDefaultGlobalConfig } from "../init/config.js";
import { generateLaunchdPlist, LAUNCHD_LABEL } from "../init/launchd.js";
import {
  generateSystemdServiceUnit,
  generateSystemdSocketUnit,
  SYSTEMD_UNIT_NAME,
} from "../init/systemd.js";

export interface InitOptions {
  platform: NodeJS.Platform;
  homeDir: string;
  execPath: string;
  daemonEntry: string;
  globalConfigPath: string;
  socketPath: string;
  writeServiceFile: (path: string, content: string) => void;
  runCommand: (cmd: string, args: string[]) => Promise<void>;
}

async function installLaunchd(options: InitOptions): Promise<void> {
  const plistPath = join(
    options.homeDir,
    "Library",
    "LaunchAgents",
    `${LAUNCHD_LABEL}.plist`,
  );
  const plist = generateLaunchdPlist({
    socketPath: options.socketPath,
    execPath: options.execPath,
    daemonEntry: options.daemonEntry,
  });
  options.writeServiceFile(plistPath, plist);

  await options.runCommand("launchctl", [
    "bootstrap",
    `gui/${process.getuid?.() ?? 0}`,
    plistPath,
  ]);
}

async function installSystemd(options: InitOptions): Promise<void> {
  const unitDir = join(options.homeDir, ".config", "systemd", "user");
  const socketUnitPath = join(unitDir, `${SYSTEMD_UNIT_NAME}.socket`);
  const serviceUnitPath = join(unitDir, `${SYSTEMD_UNIT_NAME}.service`);

  options.writeServiceFile(
    socketUnitPath,
    generateSystemdSocketUnit({ socketPath: options.socketPath }),
  );
  options.writeServiceFile(
    serviceUnitPath,
    generateSystemdServiceUnit({
      execPath: options.execPath,
      daemonEntry: options.daemonEntry,
    }),
  );

  await options.runCommand("systemctl", ["--user", "daemon-reload"]);
  await options.runCommand("systemctl", [
    "--user",
    "enable",
    "--now",
    `${SYSTEMD_UNIT_NAME}.socket`,
  ]);
}

export async function initCommand(options: InitOptions): Promise<void> {
  writeDefaultGlobalConfig(options.globalConfigPath);

  if (options.platform === "darwin") {
    await installLaunchd(options);
  } else if (options.platform === "linux") {
    await installSystemd(options);
  }
  // Windows keeps the lazy auto-start path — nothing to install.
}
