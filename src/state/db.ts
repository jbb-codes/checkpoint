import Database from "better-sqlite3";

export interface RunStore {
  createRun(id: string, startedAt: string): void;
  finishRun(id: string, status: "passed" | "failed", finishedAt: string): void;
  close(): void;
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

  const insertRun = db.prepare(
    "INSERT INTO runs (id, status, started_at) VALUES (?, 'running', ?)",
  );
  const updateRun = db.prepare(
    "UPDATE runs SET status = ?, finished_at = ? WHERE id = ?",
  );

  return {
    createRun(id, startedAt) {
      insertRun.run(id, startedAt);
    },
    finishRun(id, status, finishedAt) {
      updateRun.run(status, finishedAt, id);
    },
    close() {
      db.close();
    },
  };
}
