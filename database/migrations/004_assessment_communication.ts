import type Database from 'better-sqlite3';

export const up = (db: Database.Database) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS class_tests (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, test_date TEXT NOT NULL,
      session_id INTEGER NOT NULL REFERENCES school_sessions(id), class_id INTEGER NOT NULL REFERENCES classes(id),
      section_id INTEGER REFERENCES sections(id), subject_id INTEGER NOT NULL REFERENCES subjects(id),
      teacher_id INTEGER REFERENCES staff(id) ON DELETE SET NULL, total_marks REAL NOT NULL, passing_marks REAL NOT NULL,
      contribution_percent REAL NOT NULL DEFAULT 25, status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
      created_by INTEGER REFERENCES users(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS class_test_marks (
      id INTEGER PRIMARY KEY AUTOINCREMENT, class_test_id INTEGER NOT NULL REFERENCES class_tests(id) ON DELETE CASCADE,
      student_id INTEGER NOT NULL REFERENCES students(id), obtained_marks REAL, remarks TEXT, entered_by INTEGER REFERENCES users(id),
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(class_test_id, student_id)
    );
    CREATE TABLE IF NOT EXISTS exam_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, code TEXT NOT NULL UNIQUE,
      default_weight REAL NOT NULL DEFAULT 75, status TEXT NOT NULL DEFAULT 'active'
    );
    CREATE TABLE IF NOT EXISTS exams (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, exam_type_id INTEGER REFERENCES exam_types(id) ON DELETE SET NULL,
      session_id INTEGER NOT NULL REFERENCES school_sessions(id), starts_on TEXT, ends_on TEXT,
      class_test_weight REAL NOT NULL DEFAULT 25, exam_weight REAL NOT NULL DEFAULT 75,
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','marks_entry','submitted','approved','published','archived')),
      created_by INTEGER REFERENCES users(id), approved_by INTEGER REFERENCES users(id), approved_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS exam_subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT, exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
      class_id INTEGER NOT NULL REFERENCES classes(id), section_id INTEGER REFERENCES sections(id), subject_id INTEGER NOT NULL REFERENCES subjects(id),
      teacher_id INTEGER REFERENCES staff(id) ON DELETE SET NULL, exam_date TEXT, total_marks REAL NOT NULL DEFAULT 100,
      passing_marks REAL NOT NULL DEFAULT 40, UNIQUE(exam_id, class_id, section_id, subject_id)
    );
    CREATE TABLE IF NOT EXISTS exam_marks (
      id INTEGER PRIMARY KEY AUTOINCREMENT, exam_subject_id INTEGER NOT NULL REFERENCES exam_subjects(id) ON DELETE CASCADE,
      student_id INTEGER NOT NULL REFERENCES students(id), obtained_marks REAL, remarks TEXT,
      entered_by INTEGER REFERENCES users(id), updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(exam_subject_id, student_id)
    );
    CREATE TABLE IF NOT EXISTS result_publications (
      id INTEGER PRIMARY KEY AUTOINCREMENT, exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
      class_id INTEGER NOT NULL REFERENCES classes(id), section_id INTEGER REFERENCES sections(id), published_by INTEGER NOT NULL REFERENCES users(id),
      published_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(exam_id, class_id, section_id)
    );
    CREATE TABLE IF NOT EXISTS sms_gateway_settings (
      id INTEGER PRIMARY KEY CHECK(id = 1), provider_name TEXT, api_url TEXT, api_key TEXT, sender_id TEXT,
      is_enabled INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sms_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, body TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sms_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER REFERENCES students(id) ON DELETE SET NULL,
      phone TEXT NOT NULL, message TEXT NOT NULL, template_code TEXT, channel TEXT NOT NULL DEFAULT 'sms'
        CHECK(channel IN ('sms','whatsapp')), status TEXT NOT NULL DEFAULT 'queued'
        CHECK(status IN ('queued','sent','failed','delivered')),
      provider_response TEXT, sent_by INTEGER REFERENCES users(id), sent_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_sms_logs_created ON sms_logs(created_at DESC);
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL, body TEXT, type TEXT NOT NULL DEFAULT 'info', is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
};
