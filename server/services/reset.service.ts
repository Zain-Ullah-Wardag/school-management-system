import fs from 'fs';
import path from 'path';
import { getDatabase } from '../../database';
import { seedDatabase } from '../../database/seed';
import { ApiError } from '../utils/errors';
import { BackupService } from './backup.service';

export class ResetService {
  async reset(input: Record<string, unknown>, administratorId: number) {
    const mode = input.mode === 'new_year' ? 'new_year' : input.mode === 'demo_reset' ? 'demo_reset' : null;
    if (!mode) throw new ApiError(422, 'Choose a reset mode');
    if (input.confirmation !== 'RESET SCHOOL DATA') throw new ApiError(422, 'Type RESET SCHOOL DATA to confirm this destructive action');

    const backup = await new BackupService().create();
    const db = getDatabase();
    const before = this.counts();
    db.transaction(() => {
      this.clearOperationalData(db, mode === 'demo_reset', input.archive_students === true || input.archive_students === 'true');
      if (mode === 'demo_reset') this.clearDemoConfiguration(db, administratorId);
      else this.startNewAcademicYear(db, input, administratorId);
      db.prepare(`INSERT INTO activity_logs (user_id,action,entity_type,summary,meta_json) VALUES (?,?,?,?,?)`)
        .run(administratorId, mode, 'system', mode === 'demo_reset' ? 'Reset School Data to clean installation state' : 'Archived operational data and started a new academic year', JSON.stringify({ backup: backup.file_name, before }));
    })();

    if (mode === 'demo_reset') this.clearUploads();
    return { mode, backup, before, after: this.counts(), recovery: 'The pre-reset backup is available in Settings → Backup & restore. Restore it to recover all removed records.' };
  }

  private clearOperationalData(db: ReturnType<typeof getDatabase>, removeStudents: boolean, archiveStudents: boolean) {
    const statements = [
      'DELETE FROM notifications',
      'DELETE FROM sms_logs',
      'DELETE FROM staff_attendance',
      'DELETE FROM attendance_records',
      'DELETE FROM attendance_sessions',
      'DELETE FROM payment_allocations',
      'DELETE FROM payments',
      'DELETE FROM invoice_items',
      'DELETE FROM invoices',
      'DELETE FROM income_entries',
      'DELETE FROM expenses',
      'DELETE FROM class_test_marks',
      'DELETE FROM class_tests',
      'DELETE FROM exam_marks',
      'DELETE FROM result_publications',
      'DELETE FROM exam_subjects',
      'DELETE FROM exams',
      'DELETE FROM timetable_entries',
      'DELETE FROM visitor_logs'
    ];
    statements.forEach((statement) => db.prepare(statement).run());
    if (removeStudents) {
      ['DELETE FROM student_documents', 'DELETE FROM student_contacts', 'DELETE FROM student_promotions', 'DELETE FROM enrollments', 'DELETE FROM students'].forEach((statement) => db.prepare(statement).run());
    } else {
      db.prepare("UPDATE enrollments SET status='completed',ended_on=date('now') WHERE status='active'").run();
      if (archiveStudents) db.prepare("UPDATE students SET status='archived' WHERE status='active'").run();
    }
  }

  private clearDemoConfiguration(db: ReturnType<typeof getDatabase>, administratorId: number) {
    [
      'DELETE FROM class_subjects',
      'DELETE FROM fee_structures',
      'DELETE FROM sections',
      'DELETE FROM classes',
      'DELETE FROM subjects',
      'DELETE FROM rooms',
      'DELETE FROM staff_salary_history',
      'DELETE FROM staff',
      'DELETE FROM departments',
      'DELETE FROM designations',
      'DELETE FROM fee_heads',
      'DELETE FROM expense_categories',
      'DELETE FROM exam_types',
      'DELETE FROM timetable_periods',
      'DELETE FROM timetable_settings',
      'DELETE FROM school_days',
      'DELETE FROM school_sessions',
      'DELETE FROM activity_logs',
      'DELETE FROM users WHERE id<>' + Number(administratorId)
    ].forEach((statement) => db.prepare(statement).run());
    db.prepare("DELETE FROM settings WHERE key='system.demo_initialized'").run();
    seedDatabase(db);
  }

  private startNewAcademicYear(db: ReturnType<typeof getDatabase>, input: Record<string, unknown>, administratorId: number) {
    const current = db.prepare('SELECT * FROM school_sessions WHERE is_current=1').get() as { name: string; ends_on: string } | undefined;
    const startYear = current ? new Date(`${current.ends_on}T00:00:00`).getFullYear() : new Date().getFullYear();
    const name = String(input.new_session_name || `${startYear}-${startYear + 1}`);
    const startsOn = String(input.starts_on || `${startYear}-04-01`);
    const endsOn = String(input.ends_on || `${startYear + 1}-03-31`);
    db.prepare("UPDATE school_sessions SET is_current=0,status='closed' WHERE is_current=1").run();
    db.prepare(`INSERT INTO school_sessions (name,starts_on,ends_on,is_current,status) VALUES (?,?,?,?,?)`).run(name, startsOn, endsOn, 1, 'active');
    db.prepare("DELETE FROM settings WHERE key='system.demo_initialized'").run();
    db.prepare(`INSERT INTO activity_logs (user_id,action,entity_type,summary) VALUES (?,?,?,?)`).run(administratorId, 'new_academic_year', 'session', `Created academic session ${name}`);
  }

  private clearUploads() {
    const directory = path.resolve(process.env.UPLOAD_DIR || 'uploads');
    if (!fs.existsSync(directory)) return;
    fs.readdirSync(directory).forEach((file) => {
      if (file === '.gitkeep') return;
      fs.rmSync(path.join(directory, file), { force: true, recursive: true });
    });
  }

  private counts() {
    const db = getDatabase();
    const count = (table: string) => Number((db.prepare(`SELECT COUNT(*) total FROM ${table}`).get() as { total: number }).total);
    return { students: count('students'), staff: count('staff'), invoices: count('invoices'), attendance_sessions: count('attendance_sessions'), exams: count('exams'), messages: count('sms_logs'), visitors: count('visitor_logs') };
  }
}
