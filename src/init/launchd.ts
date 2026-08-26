export const LAUNCHD_LABEL = "dev.checkpoint.daemon";

export interface LaunchdPlistOptions {
  socketPath: string;
  execPath: string;
  daemonEntry: string;
}

export function generateLaunchdPlist(options: LaunchdPlistOptions): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LAUNCHD_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${options.execPath}</string>
    <string>${options.daemonEntry}</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>CHECKPOINT_SOCKET_ACTIVATED</key>
    <string>1</string>
  </dict>
  <key>Sockets</key>
  <dict>
    <key>Listener</key>
    <dict>
      <key>SockPathName</key>
      <string>${options.socketPath}</string>
    </dict>
  </dict>
  <key>RunAtLoad</key>
  <false/>
  <key>KeepAlive</key>
  <dict>
    <key>SuccessfulExit</key>
    <false/>
  </dict>
  <key>StandardOutPath</key>
  <string>/tmp/checkpoint-daemon.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/checkpoint-daemon.err.log</string>
</dict>
</plist>
`;
}
