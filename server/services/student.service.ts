import fs from 'fs';
import path from 'path';
import { getDatabase } from '../../database';
import { ApiError } from '../utils/errors';
import { ResultService } from './result.service';
import { pagination, required } from '../utils/http';
import { bool, nullable, today } from '../utils/serializers';

const studentColumns = ['admission_no', 'first_name', 'last_name', 'gender', 'date_of_birth', 'b_form_no', 'cnic', 'photo_path', 'blood_group', 'religion', 'nationality', 'phone', 'whatsapp', 'email', 'address', 'emergency_contact', 'admission_date', 'leaving_date', 'status'] as const;
type StudentColumn = typeof studentColumns[number];

export class StudentService {
  list(query: Record<string, unknown>) {
    const { page, limit, offset } = pagination(query as never);
    const clauses = ['1=1']; const params: unknown[] = [];
    if (typeof query.search === 'string' && query.search.trim()) {
      const like = `%${query.search.trim()}%`; clauses.push('(s.admission_no LIKE ? OR s.first_name LIKE ? OR s.last_name LIKE ? OR s.phone LIKE ?)'); params.push(like, like, like, like);
    }
    if (typeof query.status === 'string' && query.status) { clauses.push('s.status=?'); params.push(query.status); }
    else clauses.push("s.status<>'archived'");
    if (query.session_id) { clauses.push('e.session_id=?'); params.push(Number(query.session_id)); }
    if (query.class_id) { clauses.push('e.class_id=?'); params.push(Number(query.class_id)); }
    if (query.section_id) { clauses.push('e.section_id=?'); params.push(Number(query.section_id)); }
    const where = clauses.join(' AND ');
    const db = getDatabase();
    const base = `FROM students s LEFT JOIN enrollments e ON e.student_id=s.id AND e.status='active' LEFT JOIN classes c ON c.id=e.class_id LEFT JOIN sections sec ON sec.id=e.section_id`;
    const total = (db.prepare(`SELECT COUNT(*) total ${base} WHERE ${where}`).get(...params) as { total: number }).total;
    const data = db.prepare(`SELECT s.*,e.id enrollment_id,e.class_id,e.section_id,e.roll_no,c.name class_name,c.code class_code,sec.name section_name ${base} WHERE ${where} ORDER BY s.admission_no DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
    return { data, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } };
  }

  stats() {
    const db = getDatabase();
    return db.prepare(`SELECT COUNT(*) total, SUM(gender='male') boys, SUM(gender='female') girls, SUM(status='active') active FROM students`).get();
  }

  get(id: number) {
    const db = getDatabase();
    const student = db.prepare(`SELECT s.*,e.id enrollment_id,e.session_id,e.class_id,e.section_id,e.roll_no,e.started_on,c.name class_name,sec.name section_name,ss.name session_name FROM students s LEFT JOIN enrollments e ON e.student_id=s.id AND e.status='active' LEFT JOIN classes c ON c.id=e.class_id LEFT JOIN sections sec ON sec.id=e.section_id LEFT JOIN school_sessions ss ON ss.id=e.session_id WHERE s.id=?`).get(id);
    if (!student) throw new ApiError(404, 'Student not found');
    const contacts = db.prepare('SELECT * FROM student_contacts WHERE student_id=? ORDER BY is_primary DESC,contact_type').all(id);
    const documents = db.prepare('SELECT * FROM student_documents WHERE student_id=? ORDER BY uploaded_at DESC').all(id);
    const enrollments = db.prepare(`SELECT e.*,c.name class_name,sec.name section_name,ss.name session_name FROM enrollments e JOIN classes c ON c.id=e.class_id LEFT JOIN sections sec ON sec.id=e.section_id JOIN school_sessions ss ON ss.id=e.session_id WHERE e.student_id=? ORDER BY e.started_on DESC`).all(id);
    return { ...student as object, contacts, documents, enrollments };
  }

  create(input: Record<string, unknown>, _actorId: number) {
    const db = getDatabase();
    const sessionId = Number(input.session_id) || this.currentSessionId();
    const classId = Number(input.class_id);
    if (!classId || !db.prepare('SELECT 1 FROM classes WHERE id=? AND status=?').get(classId, 'active')) throw new ApiError(422, 'Select an active class');
    const admissionNo = typeof input.admission_no === 'string' && input.admission_no.trim() ? required(input.admission_no, 'Registration number') : this.nextAdmissionNumber();
    const rollNo = typeof input.roll_no === 'string' && input.roll_no.trim() ? String(input.roll_no).trim() : this.nextRollNumber(sessionId, classId, nullable(input.section_id));
    const firstName = required(input.first_name, 'Student name');
    const gender = required(input.gender, 'Gender');
    const admissionDate = required(input.admission_date, 'Admission date');
    let studentId = 0;
    db.transaction(() => {
      const values = this.values(input, { admission_no: admissionNo, first_name: firstName, gender, admission_date: admissionDate, status: input.status || 'active' });
      const sql = `INSERT INTO students (${studentColumns.join(',')}) VALUES (${studentColumns.map(() => '?').join(',')})`;
      studentId = Number(db.prepare(sql).run(...studentColumns.map((field) => values[field])).lastInsertRowid);
      db.prepare(`INSERT INTO enrollments (student_id,session_id,class_id,section_id,roll_no,started_on,status) VALUES (?,?,?,?,?,?, 'active')`)
        .run(studentId, sessionId, classId, nullable(input.section_id), rollNo, admissionDate);
      this.saveContacts(studentId, Array.isArray(input.contacts) ? input.contacts : []);
    })();
    return this.get(studentId);
  }

  update(id: number, input: Record<string, unknown>) {
    const db = getDatabase();
    const existing = db.prepare('SELECT * FROM students WHERE id=?').get(id) as Record<string, unknown> | undefined;
    if (!existing) throw new ApiError(404, 'Student not found');
    db.transaction(() => {
      const values = this.values({ ...input, _existing: existing });
      const assignments = studentColumns.map((field) => `${field}=?`).join(',');
      db.prepare(`UPDATE students SET ${assignments},updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(...studentColumns.map((field) => values[field]), id);
      if (input.class_id) {
        const enrollment = db.prepare(`SELECT id FROM enrollments WHERE student_id=? AND status='active'`).get(id) as { id: number } | undefined;
        if (enrollment) {
          const nextClassId = Number(input.class_id);
          const nextSectionId = nullable(input.section_id);
          const nextRoll = typeof input.roll_no === 'string' && input.roll_no.trim() ? input.roll_no.trim() : this.nextRollNumber(Number(input.session_id) || this.currentSessionId(), nextClassId, nextSectionId, id);
          db.prepare('UPDATE enrollments SET class_id=?,section_id=?,roll_no=? WHERE id=?').run(nextClassId, nextSectionId, nextRoll, enrollment.id);
        }
      }
      if (Array.isArray(input.contacts)) this.saveContacts(id, input.contacts);
    })();
    return this.get(id);
  }

  archive(id: number) {
    const result = getDatabase().prepare(`UPDATE students SET status='archived',updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(id);
    if (!result.changes) throw new ApiError(404, 'Student not found');
  }

  restore(id: number) {
    const result = getDatabase().prepare(`UPDATE students SET status='active',leaving_date=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='archived'`).run(id);
    if (!result.changes) throw new ApiError(404, 'Archived student not found');
    return this.get(id);
  }

  nextIdentifiers(classId?: number, sectionId?: number | null, sessionId?: number) {
    const activeSessionId = sessionId || this.currentSessionId();
    return {
      admission_no: this.nextAdmissionNumber(),
      roll_no: classId ? this.nextRollNumber(activeSessionId, classId, sectionId ?? null) : null
    };
  }

  classTestHistory(studentId: number) {
    const db = getDatabase();
    if (!db.prepare('SELECT 1 FROM students WHERE id=?').get(studentId)) throw new ApiError(404, 'Student not found');
    const rows = db.prepare(`
      SELECT ct.id class_test_id,ct.name,ct.test_date,ct.total_marks,ct.passing_marks,ct.status,
        c.name class_name,sec.name section_name,sub.name subject_name,ctm.obtained_marks,ctm.remarks
      FROM class_test_marks ctm
      JOIN class_tests ct ON ct.id=ctm.class_test_id
      JOIN classes c ON c.id=ct.class_id
      LEFT JOIN sections sec ON sec.id=ct.section_id
      JOIN subjects sub ON sub.id=ct.subject_id
      WHERE ctm.student_id=?
      ORDER BY ct.test_date DESC,ct.id DESC
    `).all(studentId) as { total_marks: number; passing_marks: number; obtained_marks: number | null; [key: string]: unknown }[];
    return rows.map((row) => {
      const percentage = row.obtained_marks === null || !row.total_marks ? 0 : Number((Number(row.obtained_marks) * 100 / Number(row.total_marks)).toFixed(2));
      const grade = percentage >= 90 ? 'A+' : percentage >= 80 ? 'A' : percentage >= 70 ? 'B' : percentage >= 60 ? 'C' : percentage >= 50 ? 'D' : percentage >= 40 ? 'E' : 'F';
      return { ...row, percentage, grade, result_status: row.obtained_marks !== null && Number(row.obtained_marks) >= Number(row.passing_marks) ? 'Pass' : 'Fail' };
    });
  }

  academicResults(studentId: number) {
    const db = getDatabase();
    const exams = db.prepare(`
      SELECT DISTINCT e.id exam_id,e.name,e.status,e.starts_on,e.ends_on,es.class_id,es.section_id,c.name class_name,sec.name section_name
      FROM exam_marks em
      JOIN exam_subjects es ON es.id=em.exam_subject_id
      JOIN exams e ON e.id=es.exam_id
      JOIN classes c ON c.id=es.class_id
      LEFT JOIN sections sec ON sec.id=es.section_id
      WHERE em.student_id=? AND e.status='published'
      ORDER BY e.ends_on DESC,e.created_at DESC
    `).all(studentId) as { exam_id: number; class_id: number; section_id: number | null; name: string; [key: string]: unknown }[];
    const service = new ResultService();
    return exams.map((exam) => {
      const result = service.result(exam.exam_id, studentId, exam.class_id, exam.section_id);
      const name = exam.name.toLowerCase();
      return { ...result, class_id: exam.class_id, section_id: exam.section_id, exam_type: name.includes('final') ? 'final' : name.includes('mid') ? 'midterm' : 'exam' };
    });
  }

  addDocument(studentId: number, input: Record<string, unknown>, userId: number) {
    if (!this.get(studentId)) throw new ApiError(404, 'Student not found');
    const result = getDatabase().prepare(`INSERT INTO student_documents (student_id,document_type,file_name,file_path,mime_type,uploaded_by) VALUES (?,?,?,?,?,?)`)
      .run(studentId, required(input.document_type, 'Document type'), required(input.file_name, 'File name'), required(input.file_path, 'File path'), nullable(input.mime_type), userId);
    return getDatabase().prepare('SELECT * FROM student_documents WHERE id=?').get(result.lastInsertRowid);
  }

  addUploadedDocuments(studentId: number, files: Express.Multer.File[], userId: number) {
    if (!this.get(studentId)) throw new ApiError(404, 'Student not found');
    const insert = getDatabase().prepare(`INSERT INTO student_documents (student_id,document_type,file_name,file_path,mime_type,uploaded_by) VALUES (?,?,?,?,?,?)`);
    const classify = (name: string) => {
      const lower = name.toLowerCase();
      if (lower.includes('birth')) return 'Birth Certificate';
      if (lower.includes('b-form') || lower.includes('bform')) return 'B Form';
      if (lower.includes('result')) return 'Previous Result';
      return 'Other Document';
    };
    return files.map((file) => {
      const id = Number(insert.run(studentId, classify(file.originalname), file.originalname, `/uploads/${file.filename}`, file.mimetype, userId).lastInsertRowid);
      return getDatabase().prepare('SELECT * FROM student_documents WHERE id=?').get(id);
    });
  }

  replaceDocument(studentId: number, documentId: number, file: Express.Multer.File, userId: number) {
    const db = getDatabase();
    const existing = db.prepare('SELECT file_path FROM student_documents WHERE id=? AND student_id=?').get(documentId, studentId) as { file_path: string } | undefined;
    if (!existing) throw new ApiError(404, 'Document not found');
    const lower = file.originalname.toLowerCase();
    const type = lower.includes('birth') ? 'Birth Certificate' : lower.includes('b-form') || lower.includes('bform') ? 'B Form' : lower.includes('result') ? 'Previous Result' : 'Other Document';
    db.prepare(`UPDATE student_documents SET document_type=?,file_name=?,file_path=?,mime_type=?,uploaded_by=?,uploaded_at=CURRENT_TIMESTAMP WHERE id=? AND student_id=?`)
      .run(type, file.originalname, `/uploads/${file.filename}`, file.mimetype, userId, documentId, studentId);
    const uploadRoot = path.resolve(process.env.UPLOAD_DIR || 'uploads');
    const oldFile = path.join(uploadRoot, path.basename(existing.file_path));
    if (oldFile.startsWith(uploadRoot)) fs.rmSync(oldFile, { force: true });
    return db.prepare('SELECT * FROM student_documents WHERE id=?').get(documentId);
  }

  removeDocument(studentId: number, documentId: number) {
    const db = getDatabase();
    const document = db.prepare('SELECT file_path FROM student_documents WHERE id=? AND student_id=?').get(documentId, studentId) as { file_path: string } | undefined;
    if (!document) throw new ApiError(404, 'Document not found');
    db.prepare('DELETE FROM student_documents WHERE id=? AND student_id=?').run(documentId, studentId);
    const uploadRoot = path.resolve(process.env.UPLOAD_DIR || 'uploads');
    const fileName = path.basename(document.file_path);
    const file = path.join(uploadRoot, fileName);
    if (file.startsWith(uploadRoot)) fs.rmSync(file, { force: true });
  }

  promote(id: number, input: Record<string, unknown>, actorId: number) {
    const db = getDatabase();
    const active = db.prepare(`SELECT * FROM enrollments WHERE student_id=? AND status='active'`).get(id) as { id: number; roll_no: string | null } | undefined;
    if (!active) throw new ApiError(422, 'Student does not have an active enrollment');
    const toClass = Number(input.to_class_id); const toSession = Number(input.to_session_id) || this.currentSessionId();
    if (!toClass) throw new ApiError(422, 'Target class is required');
    const type = input.promotion_type === 'repeated' ? 'repeated' : input.promotion_type === 'manual' ? 'manual' : 'promoted';
    const keepRoll = bool(input.keep_roll_no);
    db.transaction(() => {
      db.prepare(`UPDATE enrollments SET status=?,ended_on=? WHERE id=?`).run(type === 'repeated' ? 'repeated' : 'promoted', today(), active.id);
      const insert = db.prepare(`INSERT INTO enrollments (student_id,session_id,class_id,section_id,roll_no,started_on,status,approved_by,approved_at) VALUES (?,?,?,?,?,?,?,?,?)`);
      insert.run(id, toSession, toClass, nullable(input.to_section_id), keepRoll ? active.roll_no : nullable(input.roll_no), today(), 'active', bool(input.principal_approved) ? actorId : null, bool(input.principal_approved) ? new Date().toISOString() : null);
      db.prepare(`INSERT INTO student_promotions (student_id,from_enrollment_id,to_session_id,to_class_id,to_section_id,promotion_type,keep_roll_no,principal_approved_by,note,promoted_on) VALUES (?,?,?,?,?,?,?,?,?,?)`)
        .run(id, active.id, toSession, toClass, nullable(input.to_section_id), type, keepRoll ? 1 : 0, bool(input.principal_approved) ? actorId : null, nullable(input.note), today());
    })();
    return this.get(id);
  }

  autoPromote(input: Record<string, unknown>, actorId: number) {
    const db = getDatabase();
    const fromClass = Number(input.from_class_id); const toClass = Number(input.to_class_id);
    const toSession = Number(input.to_session_id) || this.currentSessionId();
    if (!fromClass || !toClass) throw new ApiError(422, 'Source and target classes are required');
    const fromSection = nullable(input.from_section_id); const toSection = nullable(input.to_section_id);
    const promotionType = input.promotion_type === 'repeated' ? 'repeated' : 'promoted';
    const keepRoll = bool(input.keep_roll_no); const approved = bool(input.principal_approved);
    const active = db.prepare(`SELECT * FROM enrollments WHERE class_id=? AND section_id IS ? AND status='active'`).all(fromClass, fromSection) as { id: number; student_id: number; roll_no: string | null }[];
    let promoted = 0;
    db.transaction(() => {
      const update = db.prepare(`UPDATE enrollments SET status=?,ended_on=? WHERE id=?`);
      const enrollment = db.prepare(`INSERT INTO enrollments (student_id,session_id,class_id,section_id,roll_no,started_on,status,approved_by,approved_at) VALUES (?,?,?,?,?,?,?,?,?)`);
      const history = db.prepare(`INSERT INTO student_promotions (student_id,from_enrollment_id,to_session_id,to_class_id,to_section_id,promotion_type,keep_roll_no,principal_approved_by,note,promoted_on) VALUES (?,?,?,?,?,?,?,?,?,?)`);
      for (const row of active) {
        update.run(promotionType === 'repeated' ? 'repeated' : 'promoted', today(), row.id);
        enrollment.run(row.student_id, toSession, toClass, toSection, keepRoll ? row.roll_no : null, today(), 'active', approved ? actorId : null, approved ? new Date().toISOString() : null);
        history.run(row.student_id, row.id, toSession, toClass, toSection, promotionType, keepRoll ? 1 : 0, approved ? actorId : null, nullable(input.note), today());
        promoted += 1;
      }
    })();
    return { promoted, source_count: active.length, promotion_type: promotionType };
  }

  private values(input: Record<string, unknown>, overrides: Partial<Record<StudentColumn, unknown>> = {}) {
    const existing = input._existing as Record<string, unknown> | undefined;
    const record: Record<string, unknown> = {};
    for (const field of studentColumns) record[field] = field in overrides ? overrides[field] : field in input ? nullable(input[field]) : existing?.[field] ?? null;
    record.nationality = record.nationality || 'Pakistani';
    record.status = ['active', 'inactive', 'left', 'graduated', 'archived'].includes(String(record.status)) ? record.status : 'active';
    return record;
  }

  private saveContacts(studentId: number, contacts: unknown[]) {
    const db = getDatabase();
    db.prepare('DELETE FROM student_contacts WHERE student_id=?').run(studentId);
    const insert = db.prepare(`INSERT INTO student_contacts (student_id,contact_type,full_name,relation,cnic,phone,whatsapp,email,occupation,is_primary) VALUES (?,?,?,?,?,?,?,?,?,?)`);
    contacts.forEach((raw) => {
      const contact = raw as Record<string, unknown>;
      if (!contact.full_name || !contact.contact_type) return;
      insert.run(studentId, contact.contact_type, String(contact.full_name), nullable(contact.relation), nullable(contact.cnic), nullable(contact.phone), nullable(contact.whatsapp), nullable(contact.email), nullable(contact.occupation), bool(contact.is_primary) ? 1 : 0);
    });
  }

  private nextAdmissionNumber() {
    const db = getDatabase();
    const prefix = `REG-${new Date().getFullYear()}-`;
    const latest = db.prepare(`SELECT admission_no FROM students WHERE admission_no LIKE ? ORDER BY admission_no DESC LIMIT 1`).get(`${prefix}%`) as { admission_no: string } | undefined;
    const numeric = latest ? Number(latest.admission_no.slice(prefix.length)) || 0 : 0;
    let sequence = numeric + 1;
    let candidate = `${prefix}${String(sequence).padStart(5, '0')}`;
    while (db.prepare('SELECT 1 FROM students WHERE admission_no=?').get(candidate)) {
      sequence += 1;
      candidate = `${prefix}${String(sequence).padStart(5, '0')}`;
    }
    return candidate;
  }

  private nextRollNumber(sessionId: number, classId: number, sectionId: unknown, excludingStudentId?: number) {
    const db = getDatabase();
    const row = db.prepare(`
      SELECT MAX(CAST(roll_no AS INTEGER)) AS highest
      FROM enrollments
      WHERE session_id=? AND class_id=? AND section_id IS ? AND status='active'
        ${excludingStudentId ? 'AND student_id<>?' : ''}
    `).get(...(excludingStudentId ? [sessionId, classId, sectionId, excludingStudentId] : [sessionId, classId, sectionId])) as { highest: number | null };
    return String((row.highest || 0) + 1);
  }

  private currentSessionId() {
    const session = getDatabase().prepare(`SELECT id FROM school_sessions WHERE is_current=1`).get() as { id: number } | undefined;
    if (!session) throw new ApiError(422, 'Set a current academic session before registering students');
    return session.id;
  }
}
