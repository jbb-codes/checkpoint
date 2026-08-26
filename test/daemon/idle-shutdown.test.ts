import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { startIdleShutdown } from "../../src/daemon/idle-shutdown.js";

describe("startIdleShutdown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires onIdle after the timeout with no open connections", () => {
    const onIdle = vi.fn();
    const idle = startIdleShutdown(onIdle, 1000);

    vi.advanceTimersByTime(1000);

    expect(onIdle).toHaveBeenCalledOnce();
    idle.dispose();
  });

  it("does not fire while a connection is open", () => {
    const onIdle = vi.fn();
    const idle = startIdleShutdown(onIdle, 1000);

    idle.connectionOpened();
    vi.advanceTimersByTime(5000);

    expect(onIdle).not.toHaveBeenCalled();
    idle.dispose();
  });

  it("restarts the idle timer once the last open connection closes", () => {
    const onIdle = vi.fn();
    const idle = startIdleShutdown(onIdle, 1000);

    idle.connectionOpened();
    vi.advanceTimersByTime(5000);
    idle.connectionClosed();
    vi.advanceTimersByTime(999);
    expect(onIdle).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onIdle).toHaveBeenCalledOnce();
    idle.dispose();
  });

  it("dispose cancels the pending timer", () => {
    const onIdle = vi.fn();
    const idle = startIdleShutdown(onIdle, 1000);

    idle.dispose();
    vi.advanceTimersByTime(5000);

    expect(onIdle).not.toHaveBeenCalled();
  });
});
