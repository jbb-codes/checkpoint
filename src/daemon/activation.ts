const ACTIVATED_FD = 3;

export interface ActivationEnv {
  LISTEN_FDS?: string;
  LISTEN_PID?: string;
  CHECKPOINT_SOCKET_ACTIVATED?: string;
  [key: string]: string | undefined;
}

/**
 * Resolves the file descriptor an OS-managed service (systemd socket
 * activation, or our own launchd activation flag) has already bound and
 * handed to this process, if any. Returns undefined when the daemon should
 * create its own socket (lazy-start path).
 */
export function resolveActivationFd(
  env: ActivationEnv,
  pid: number = process.pid,
): number | undefined {
  if (env.CHECKPOINT_SOCKET_ACTIVATED === "1") {
    return ACTIVATED_FD;
  }

  if (env.LISTEN_FDS && env.LISTEN_PID === String(pid)) {
    return ACTIVATED_FD;
  }

  return undefined;
}

export type ListenTarget = string | { fd: number };

/**
 * The socket path to bind (lazy-start path), or the pre-bound fd the OS
 * already listened on (socket-activation path) for net.Server#listen.
 */
export function resolveListenTarget(
  socketPath: string,
  activationFd: number | undefined,
): ListenTarget {
  return activationFd !== undefined ? { fd: activationFd } : socketPath;
}
