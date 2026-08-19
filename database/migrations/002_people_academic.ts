import type Database from 'better-sqlite3';

export const up = (db: Database.Database) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, description TEXT,
      status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS designations (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, description TEXT,
      status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS staff (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_no TEXT NOT NULL COLLATE NOCASE UNIQUE,
      user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE SET NULL,
      first_name TEXT NOT NULL, last_name TEXT, photo_path TEXT,
      cnic TEXT, qualification TEXT, department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
      designation_id INTEGER REFERENCES designations(id) ON DELETE SET NULL,
      employment_type TEXT NOT NULL DEFAULT 'permanent', salary REAL NOT NULL DEFAULT 0,
      joining_date TEXT NOT NULL, leaving_date TEXT, phone TEXT, whatsapp TEXT, email TEXT,
      address TEXT, emergency_contact TEXT, status TEXT NOT NULL DEFAULT 'active'
        CHECK(status IN ('active','inactive','archived')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS staff_salary_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT, staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
      amount REAL NOT NULL, effective_from TEXT NOT NULL, note TEXT, created_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL COLLATE NOCASE UNIQUE,
      name TEXT NOT NULL, name_ur TEXT, display_order INTEGER NOT NULL DEFAULT 0,
      head_teacher_id INTEGER REFERENCES staff(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sections (
      id INTEGER PRIMARY KEY AUTOINCREMENT, class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      name TEXT NOT NULL, capacity INTEGER, class_teacher_id INTEGER REFERENCES staff(id) ON DELETE SET NULL,
      room TEXT, status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(class_id, name)
    );
    CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL COLLATE NOCASE UNIQUE,
      name TEXT NOT NULL, name_ur TEXT, max_marks REAL NOT NULL DEFAULT 100,
      pass_marks REAL NOT NULL DEFAULT 40, status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS class_subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT, class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      section_id INTEGER REFERENCES sections(id) ON DELETE CASCADE,
      subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
      teacher_id INTEGER REFERENCES staff(id) ON DELETE SET NULL, weekly_periods INTEGER NOT NULL DEFAULT 1,
      UNIQUE(class_id, section_id, subject_id)
    );
    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, capacity INTEGER, description TEXT,
      status TEXT NOT NULL DEFAULT 'active'
    );
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admission_no TEXT NOT NULL COLLATE NOCASE UNIQUE, first_name TEXT NOT NULL, last_name TEXT,
      gender TEXT NOT NULL CHECK(gender IN ('male','female','other')), date_of_birth TEXT,
      b_form_no TEXT, cnic TEXT, photo_path TEXT, blood_group TEXT, religion TEXT, nationality TEXT DEFAULT 'Pakistani',
      phone TEXT, whatsapp TEXT, email TEXT, address TEXT, emergency_contact TEXT,
      admission_date TEXT NOT NULL, leaving_date TEXT, status TEXT NOT NULL DEFAULT 'active'
        CHECK(status IN ('active','inactive','left','graduated','archived')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_students_name ON students(first_name, last_name);
    CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);
    CREATE TABLE IF NOT EXISTS student_contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      contact_type TEXT NOT NULL CHECK(contact_type IN ('father','mother','guardian','emergency')),
      full_name TEXT NOT NULL, relation TEXT, cnic TEXT, phone TEXT, whatsapp TEXT, email TEXT, occupation TEXT,
      is_primary INTEGER NOT NULL DEFAULT 0, UNIQUE(student_id, contact_type)
    );
    CREATE TABLE IF NOT EXISTS enrollments (
      id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      session_id INTEGER NOT NULL REFERENCES school_sessions(id), class_id INTEGER NOT NULL REFERENCES classes(id),
      section_id INTEGER REFERENCES sections(id), roll_no TEXT, started_on TEXT NOT NULL, ended_on TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','promoted','repeated','left','completed')),
      approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL, approved_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE UNIQUE INDEX IF NOT EXISTS unique_active_enrollment ON enrollments(student_id) WHERE status = 'active';
    CREATE INDEX IF NOT EXISTS idx_enrollments_class ON enrollments(class_id, section_id, session_id, status);
    CREATE TABLE IF NOT EXISTS student_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      document_type TEXT NOT NULL, file_name TEXT NOT NULL, file_path TEXT NOT NULL, mime_type TEXT,
      uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL, uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS student_promotions (
      id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      from_enrollment_id INTEGER REFERENCES enrollments(id) ON DELETE SET NULL,
      to_session_id INTEGER NOT NULL REFERENCES school_sessions(id), to_class_id INTEGER NOT NULL REFERENCES classes(id),
      to_section_id INTEGER REFERENCES sections(id), promotion_type TEXT NOT NULL CHECK(promotion_type IN ('promoted','repeated','manual')),
      keep_roll_no INTEGER NOT NULL DEFAULT 0, principal_approved_by INTEGER REFERENCES users(id),
      note TEXT, promoted_on TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
};
