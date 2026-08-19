import type Database from 'better-sqlite3';

/**
 * SQLite cannot express a CHECK that compares a mark with the total held in a
 * different table. These triggers enforce that relationship even when a client
 * bypasses the HTTP API and writes directly to the database.
 */
export const up = (db: Database.Database) => {
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS validate_class_test_definition_insert
    BEFORE INSERT ON class_tests
    FOR EACH ROW
    WHEN NEW.total_marks IS NULL
      OR typeof(NEW.total_marks) NOT IN ('integer','real')
      OR NEW.total_marks <= 0
      OR NEW.passing_marks IS NULL
      OR typeof(NEW.passing_marks) NOT IN ('integer','real')
      OR NEW.passing_marks < 0
      OR NEW.passing_marks > NEW.total_marks
    BEGIN
      SELECT RAISE(ABORT, 'Total marks must be positive and passing marks cannot exceed total marks');
    END;

    CREATE TRIGGER IF NOT EXISTS validate_class_test_definition_update
    BEFORE UPDATE OF total_marks, passing_marks ON class_tests
    FOR EACH ROW
    WHEN NEW.total_marks IS NULL
      OR typeof(NEW.total_marks) NOT IN ('integer','real')
      OR NEW.total_marks <= 0
      OR NEW.passing_marks IS NULL
      OR typeof(NEW.passing_marks) NOT IN ('integer','real')
      OR NEW.passing_marks < 0
      OR NEW.passing_marks > NEW.total_marks
      OR EXISTS(SELECT 1 FROM class_test_marks WHERE class_test_id=NEW.id AND obtained_marks > NEW.total_marks)
    BEGIN
      SELECT RAISE(ABORT, 'Total marks must be positive, cover existing marks, and be at least the passing marks');
    END;

    CREATE TRIGGER IF NOT EXISTS validate_exam_subject_definition_insert
    BEFORE INSERT ON exam_subjects
    FOR EACH ROW
    WHEN NEW.total_marks IS NULL
      OR typeof(NEW.total_marks) NOT IN ('integer','real')
      OR NEW.total_marks <= 0
      OR NEW.passing_marks IS NULL
      OR typeof(NEW.passing_marks) NOT IN ('integer','real')
      OR NEW.passing_marks < 0
      OR NEW.passing_marks > NEW.total_marks
    BEGIN
      SELECT RAISE(ABORT, 'Total marks must be positive and passing marks cannot exceed total marks');
    END;

    CREATE TRIGGER IF NOT EXISTS validate_exam_subject_definition_update
    BEFORE UPDATE OF total_marks, passing_marks ON exam_subjects
    FOR EACH ROW
    WHEN NEW.total_marks IS NULL
      OR typeof(NEW.total_marks) NOT IN ('integer','real')
      OR NEW.total_marks <= 0
      OR NEW.passing_marks IS NULL
      OR typeof(NEW.passing_marks) NOT IN ('integer','real')
      OR NEW.passing_marks < 0
      OR NEW.passing_marks > NEW.total_marks
      OR EXISTS(SELECT 1 FROM exam_marks WHERE exam_subject_id=NEW.id AND obtained_marks > NEW.total_marks)
    BEGIN
      SELECT RAISE(ABORT, 'Total marks must be positive, cover existing marks, and be at least the passing marks');
    END;

    CREATE TRIGGER IF NOT EXISTS validate_class_test_mark_insert
    BEFORE INSERT ON class_test_marks
    FOR EACH ROW
    WHEN NEW.obtained_marks IS NOT NULL AND (
      typeof(NEW.obtained_marks) NOT IN ('integer','real')
      OR NEW.obtained_marks < 0
      OR NEW.obtained_marks > COALESCE((SELECT total_marks FROM class_tests WHERE id=NEW.class_test_id), -1)
    )
    BEGIN
      SELECT RAISE(ABORT, 'Obtained marks cannot exceed total marks or be negative');
    END;

    CREATE TRIGGER IF NOT EXISTS validate_class_test_mark_update
    BEFORE UPDATE OF obtained_marks, class_test_id ON class_test_marks
    FOR EACH ROW
    WHEN NEW.obtained_marks IS NOT NULL AND (
      typeof(NEW.obtained_marks) NOT IN ('integer','real')
      OR NEW.obtained_marks < 0
      OR NEW.obtained_marks > COALESCE((SELECT total_marks FROM class_tests WHERE id=NEW.class_test_id), -1)
    )
    BEGIN
      SELECT RAISE(ABORT, 'Obtained marks cannot exceed total marks or be negative');
    END;

    CREATE TRIGGER IF NOT EXISTS validate_exam_mark_insert
    BEFORE INSERT ON exam_marks
    FOR EACH ROW
    WHEN NEW.obtained_marks IS NOT NULL AND (
      typeof(NEW.obtained_marks) NOT IN ('integer','real')
      OR NEW.obtained_marks < 0
      OR NEW.obtained_marks > COALESCE((SELECT total_marks FROM exam_subjects WHERE id=NEW.exam_subject_id), -1)
    )
    BEGIN
      SELECT RAISE(ABORT, 'Obtained marks cannot exceed total marks or be negative');
    END;

    CREATE TRIGGER IF NOT EXISTS validate_exam_mark_update
    BEFORE UPDATE OF obtained_marks, exam_subject_id ON exam_marks
    FOR EACH ROW
    WHEN NEW.obtained_marks IS NOT NULL AND (
      typeof(NEW.obtained_marks) NOT IN ('integer','real')
      OR NEW.obtained_marks < 0
      OR NEW.obtained_marks > COALESCE((SELECT total_marks FROM exam_subjects WHERE id=NEW.exam_subject_id), -1)
    )
    BEGIN
      SELECT RAISE(ABORT, 'Obtained marks cannot exceed total marks or be negative');
    END;
  `);
};
