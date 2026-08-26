export interface IdleShutdown {
  connectionOpened(): void;
  connectionClosed(): void;
  dispose(): void;
}

/**
 * Calls onIdle once the daemon has had zero open connections for timeoutMs.
 * Used only under OS socket activation, where the OS restarts the daemon on
 * the next connection — never under lazy-start.
 */
export function startIdleShutdown(
  onIdle: () => void,
  timeoutMs: number,
): IdleShutdown {
  let openConnections = 0;
  let timer: NodeJS.Timeout | undefined;

  function arm(): void {
    timer = setTimeout(onIdle, timeoutMs);
  }

  arm();

  return {
    connectionOpened() {
      openConnections++;
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
    },
    connectionClosed() {
      openConnections = Math.max(0, openConnections - 1);
      if (openConnections === 0) {
        arm();
      }
    },
    dispose() {
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
    },
  };
}
