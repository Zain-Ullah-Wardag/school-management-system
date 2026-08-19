import type Database from 'better-sqlite3';

export const up = (db: Database.Database) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS school_days (
      id INTEGER PRIMARY KEY AUTOINCREMENT, weekday INTEGER NOT NULL UNIQUE CHECK(weekday BETWEEN 0 AND 6),
      is_school_day INTEGER NOT NULL DEFAULT 1, start_time TEXT, end_time TEXT
    );
    CREATE TABLE IF NOT EXISTS timetable_settings (
      id INTEGER PRIMARY KEY CHECK(id = 1), school_days_json TEXT NOT NULL DEFAULT '[1,2,3,4,5]',
      default_period_minutes INTEGER NOT NULL DEFAULT 40, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS timetable_periods (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, sequence INTEGER NOT NULL UNIQUE,
      start_time TEXT NOT NULL, end_time TEXT NOT NULL, period_type TEXT NOT NULL DEFAULT 'lesson'
        CHECK(period_type IN ('lesson','break','assembly','other'))
    );
    CREATE TABLE IF NOT EXISTS timetable_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT, session_id INTEGER NOT NULL REFERENCES school_sessions(id),
      class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE, section_id INTEGER REFERENCES sections(id) ON DELETE CASCADE,
      weekday INTEGER NOT NULL CHECK(weekday BETWEEN 0 AND 6), period_id INTEGER NOT NULL REFERENCES timetable_periods(id) ON DELETE CASCADE,
      subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL, teacher_id INTEGER REFERENCES staff(id) ON DELETE SET NULL,
      room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL, note TEXT,
      UNIQUE(session_id, class_id, section_id, weekday, period_id)
    );
    CREATE TABLE IF NOT EXISTS attendance_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT, attendance_date TEXT NOT NULL, session_id INTEGER NOT NULL REFERENCES school_sessions(id),
      class_id INTEGER NOT NULL REFERENCES classes(id), section_id INTEGER REFERENCES sections(id),
      marked_by INTEGER NOT NULL REFERENCES users(id), locked INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(attendance_date, session_id, class_id, section_id)
    );
    CREATE TABLE IF NOT EXISTS attendance_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT, attendance_session_id INTEGER NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
      student_id INTEGER NOT NULL REFERENCES students(id), status TEXT NOT NULL DEFAULT 'present'
        CHECK(status IN ('present','absent','leave','late')), remarks TEXT,
      marked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(attendance_session_id, student_id)
    );
    CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance_records(student_id);
    CREATE TABLE IF NOT EXISTS staff_attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT, staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
      attendance_date TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'present'
        CHECK(status IN ('present','absent','leave','late')), check_in TEXT, check_out TEXT, remarks TEXT,
      marked_by INTEGER REFERENCES users(id), UNIQUE(staff_id, attendance_date)
    );
    CREATE TABLE IF NOT EXISTS fee_heads (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, code TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL DEFAULT 'recurring' CHECK(category IN ('one_time','recurring','optional','fine','transport','other')),
      is_refundable INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS fee_structures (
      id INTEGER PRIMARY KEY AUTOINCREMENT, session_id INTEGER NOT NULL REFERENCES school_sessions(id), class_id INTEGER NOT NULL REFERENCES classes(id),
      section_id INTEGER REFERENCES sections(id), fee_head_id INTEGER NOT NULL REFERENCES fee_heads(id), amount REAL NOT NULL CHECK(amount >= 0),
      frequency TEXT NOT NULL DEFAULT 'monthly' CHECK(frequency IN ('one_time','monthly','quarterly','annual')),
      due_day INTEGER, active_from TEXT, active_to TEXT, status TEXT NOT NULL DEFAULT 'active',
      UNIQUE(session_id, class_id, section_id, fee_head_id, frequency)
    );
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT, invoice_no TEXT NOT NULL UNIQUE, student_id INTEGER NOT NULL REFERENCES students(id),
      session_id INTEGER NOT NULL REFERENCES school_sessions(id), issue_date TEXT NOT NULL, due_date TEXT NOT NULL,
      billing_month TEXT, subtotal REAL NOT NULL DEFAULT 0, discount REAL NOT NULL DEFAULT 0, fine REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0, paid_amount REAL NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'unpaid'
        CHECK(status IN ('draft','unpaid','partial','paid','void','overdue')),
      note TEXT, created_by INTEGER REFERENCES users(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_invoices_student_status ON invoices(student_id, status);
    CREATE TABLE IF NOT EXISTS invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT, invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      fee_head_id INTEGER REFERENCES fee_heads(id) ON DELETE SET NULL, description TEXT NOT NULL, amount REAL NOT NULL, discount REAL NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT, receipt_no TEXT NOT NULL UNIQUE, student_id INTEGER NOT NULL REFERENCES students(id),
      payment_date TEXT NOT NULL, amount REAL NOT NULL CHECK(amount > 0), method TEXT NOT NULL DEFAULT 'cash', reference_no TEXT,
      note TEXT, received_by INTEGER REFERENCES users(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS payment_allocations (
      id INTEGER PRIMARY KEY AUTOINCREMENT, payment_id INTEGER NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
      invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE, amount REAL NOT NULL CHECK(amount > 0),
      UNIQUE(payment_id, invoice_id)
    );
    CREATE TABLE IF NOT EXISTS income_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT, income_date TEXT NOT NULL, category TEXT NOT NULL, amount REAL NOT NULL CHECK(amount >= 0),
      description TEXT, reference_no TEXT, created_by INTEGER REFERENCES users(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS expense_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'active'
    );
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT, expense_date TEXT NOT NULL, category_id INTEGER REFERENCES expense_categories(id) ON DELETE SET NULL,
      amount REAL NOT NULL CHECK(amount >= 0), description TEXT, payment_method TEXT, reference_no TEXT,
      created_by INTEGER REFERENCES users(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
};
