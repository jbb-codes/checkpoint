import Database from "better-sqlite3";
import type { RunSummary } from "../protocol/messages.js";

export interface RunStore {
  createRun(id: string, repo: string, startedAt: string): void;
  finishRun(id: string, status: "passed" | "failed", finishedAt: string): void;
  markInterruptedRunsFailed(finishedAt: string): void;
  listRuns(): RunSummary[];
  close(): void;
}

interface RunRow {
  id: string;
  repo: string;
  status: "running" | "passed" | "failed";
  started_at: string;
  finished_at: string | null;
}

export function openRunStore(dbPath: string): RunStore {
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT
    )
  `);
  const existingColumns = (
    db.prepare("PRAGMA table_info(runs)").all() as { name: string }[]
  ).map((column) => column.name);
  if (!existingColumns.includes("repo")) {
    db.exec("ALTER TABLE runs ADD COLUMN repo TEXT NOT NULL DEFAULT ''");
  }

  const insertRun = db.prepare(
    "INSERT INTO runs (id, repo, status, started_at) VALUES (?, ?, 'running', ?)",
  );
  const updateRun = db.prepare(
    "UPDATE runs SET status = ?, finished_at = ? WHERE id = ?",
  );
  const markInterrupted = db.prepare(
    "UPDATE runs SET status = 'failed', finished_at = ? WHERE status = 'running'",
  );
  const selectRuns = db.prepare(
    "SELECT id, repo, status, started_at, finished_at FROM runs ORDER BY started_at DESC",
  );

  return {
    createRun(id, repo, startedAt) {
      insertRun.run(id, repo, startedAt);
    },
    finishRun(id, status, finishedAt) {
      updateRun.run(status, finishedAt, id);
    },
    markInterruptedRunsFailed(finishedAt) {
      markInterrupted.run(finishedAt);
    },
    listRuns() {
      const rows = selectRuns.all() as RunRow[];
      return rows.map((row) => ({
        id: row.id,
        repo: row.repo,
        status: row.status,
        startedAt: row.started_at,
        finishedAt: row.finished_at,
      }));
    },
    close() {
      db.close();
    },
  };
}
