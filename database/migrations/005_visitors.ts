import type Database from 'better-sqlite3';

export const up = (db: Database.Database) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS visitor_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visitor_name TEXT NOT NULL,
      phone TEXT,
      cnic TEXT,
      purpose TEXT NOT NULL,
      person_to_meet TEXT,
      check_in TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      check_out TEXT,
      note TEXT,
      status TEXT NOT NULL DEFAULT 'checked_in' CHECK(status IN ('checked_in','checked_out')),
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_visitor_logs_check_in ON visitor_logs(check_in DESC);
  `);
};
