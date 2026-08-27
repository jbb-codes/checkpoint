const ACTIVATED_FD = 3;

export interface ActivationEnv {
  LISTEN_FDS?: string;
  LISTEN_PID?: string;
  CHECKPOINT_SOCKET_ACTIVATED?: string;
  [key: string]: string | undefined;
}

export type ActivationKind = "systemd" | "launchd";

export interface Activation {
  readonly kind: ActivationKind;
  readonly fd: number;
}

/**
 * Detects whether an OS-managed service handed this process a socket on
 * startup: systemd's LISTEN_FDS/LISTEN_PID protocol, or our own launchd
 * activation flag. Returns undefined when the daemon should create its own
 * socket (lazy-start path).
 */
export function resolveActivation(
  env: ActivationEnv,
  pid: number = process.pid,
): Activation | undefined {
  if (env.CHECKPOINT_SOCKET_ACTIVATED === "1") {
    return { kind: "launchd", fd: ACTIVATED_FD };
  }

  if (env.LISTEN_FDS && env.LISTEN_PID === String(pid)) {
    return { kind: "systemd", fd: ACTIVATED_FD };
  }

  return undefined;
}

export type ListenTarget = string | { fd: number };

/**
 * The target for net.Server#listen.
 *
 * systemd hands over a socket that is bound but NOT yet listening, so we
 * pass its fd straight through and let Node's listen() call finish the job.
 *
 * launchd hands over a socket that is already bound AND listening. Calling
 * Node's listen({fd}) on it a second time crashes with ENOTTY on macOS (see
 * issue #9), so for launchd we fall back to self-binding a fresh socket at
 * the same path instead of reusing the handed-off fd.
 */
export function resolveListenTarget(
  socketPath: string,
  activation: Activation | undefined,
): ListenTarget {
  if (activation === undefined || activation.kind === "launchd") {
    return socketPath;
  }

  return { fd: activation.fd };
}
