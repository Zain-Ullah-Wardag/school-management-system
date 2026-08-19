import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import * as migration001 from './migrations/001_core';
import * as migration002 from './migrations/002_people_academic';
import * as migration003 from './migrations/003_operations';
import * as migration004 from './migrations/004_assessment_communication';
import * as migration005 from './migrations/005_visitors';
import * as migration006 from './migrations/006_messaging_providers';
import * as migration007 from './migrations/007_marks_validation';
import * as migration008 from './migrations/008_certificate_template_defaults';
import * as migration009 from './migrations/009_additional_certificate_types';
import { seedDatabase } from './seed';

const migrations = [
  ['001_core', migration001.up],
  ['002_people_academic', migration002.up],
  ['003_operations', migration003.up],
  ['004_assessment_communication', migration004.up],
  ['005_visitors', migration005.up],
  ['006_messaging_providers', migration006.up],
  ['007_marks_validation', migration007.up],
  ['008_certificate_template_defaults', migration008.up],
  ['009_additional_certificate_types', migration009.up]
] as const;

let instance: Database.Database | null = null;

export function getDatabaseFilePath() {
  const configured = process.env.DATABASE_PATH || path.join('database', 'school.db');
  return path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured);
}

export function getDatabase() {
  if (instance) return instance;
  const file = getDatabaseFilePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  instance = new Database(file);
  instance.pragma('foreign_keys = ON');
  instance.pragma('journal_mode = WAL');
  instance.pragma('busy_timeout = 5000');
  instance.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  const applied = new Set((instance.prepare('SELECT name FROM schema_migrations').all() as { name: string }[]).map((row) => row.name));
  for (const [name, migrate] of migrations) {
    if (applied.has(name)) continue;
    instance.transaction(() => {
      migrate(instance!);
      instance!.prepare('INSERT INTO schema_migrations (name) VALUES (?)').run(name);
    })();
  }
  instance.transaction(() => seedDatabase(instance!))();
  const schoolTimeZone = instance.prepare("SELECT value FROM settings WHERE key='school.timezone'").get() as { value: string } | undefined;
  if (schoolTimeZone?.value) process.env.SCHOOL_TIMEZONE = schoolTimeZone.value;
  return instance;
}

export function closeDatabase() {
  instance?.close();
  instance = null;
}
