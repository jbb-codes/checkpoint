import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { openRunStore } from "../../src/state/db.js";

describe("openRunStore migration", () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("adds the repo column to a pre-existing runs table that lacks it", () => {
    dir = mkdtempSync(join(tmpdir(), "checkpoint-db-test-"));
    const dbPath = join(dir, "state.db");

    const legacyDb = new Database(dbPath);
    legacyDb.exec(`
      CREATE TABLE runs (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        started_at TEXT NOT NULL,
        finished_at TEXT
      )
    `);
    legacyDb.close();

    const store = openRunStore(dbPath);
    store.createRun("run-1", "/some/repo", "2026-01-01T00:00:00.000Z");
    const runs = store.listRuns();
    store.close();

    expect(runs).toEqual([
      {
        id: "run-1",
        repo: "/some/repo",
        status: "running",
        startedAt: "2026-01-01T00:00:00.000Z",
        finishedAt: null,
      },
    ]);
  });
});

describe("openRunStore restart recovery", () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("marks runs left 'running' by a killed daemon as 'failed' on the next open", () => {
    dir = mkdtempSync(join(tmpdir(), "checkpoint-db-test-"));
    const dbPath = join(dir, "state.db");

    let store = openRunStore(dbPath);
    store.createRun("run-1", "/some/repo", "2026-01-01T00:00:00.000Z");
    store.createRun("run-2", "/some/repo", "2026-01-01T00:01:00.000Z");
    store.finishRun("run-2", "passed", "2026-01-01T00:02:00.000Z");
    store.close();

    store = openRunStore(dbPath);
    store.markInterruptedRunsFailed("2026-01-01T00:05:00.000Z");
    const runs = store.listRuns();
    store.close();

    const run1 = runs.find((run) => run.id === "run-1");
    const run2 = runs.find((run) => run.id === "run-2");
    expect(run1).toEqual({
      id: "run-1",
      repo: "/some/repo",
      status: "failed",
      startedAt: "2026-01-01T00:00:00.000Z",
      finishedAt: "2026-01-01T00:05:00.000Z",
    });
    expect(run2?.status).toBe("passed");
    expect(run2?.finishedAt).toBe("2026-01-01T00:02:00.000Z");
  });
});
