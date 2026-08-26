export const SYSTEMD_UNIT_NAME = "checkpoint-daemon";

export interface SystemdSocketUnitOptions {
  socketPath: string;
}

export interface SystemdServiceUnitOptions {
  execPath: string;
  daemonEntry: string;
}

export function generateSystemdSocketUnit(
  options: SystemdSocketUnitOptions,
): string {
  return `[Unit]
Description=checkpoint daemon socket

[Socket]
ListenStream=${options.socketPath}

[Install]
WantedBy=sockets.target
`;
}

export function generateSystemdServiceUnit(
  options: SystemdServiceUnitOptions,
): string {
  return `[Unit]
Description=checkpoint daemon
Requires=${SYSTEMD_UNIT_NAME}.socket

[Service]
ExecStart=${options.execPath} ${options.daemonEntry}
Environment=CHECKPOINT_SOCKET_ACTIVATED=1
Restart=on-failure
`;
}
