import { getDatabase } from '../../database';
import { ApiError } from '../utils/errors';
import { pagination, required } from '../utils/http';
import { nullable, number, today } from '../utils/serializers';
import { ResultService } from './result.service';

const session = () => {
  const row = getDatabase().prepare('SELECT id FROM school_sessions WHERE is_current=1').get() as { id: number } | undefined;
  if (!row) throw new ApiError(422, 'Current session is not configured');
  return row.id;
};

const settingNumber = (key: string, fallback: number) => Number((getDatabase().prepare('SELECT value FROM settings WHERE key=?').get(key) as { value: string } | undefined)?.value || fallback);

function requiredFiniteNumber(value: unknown, label: string) {
  if (value === null || value === undefined || value === '' || (typeof value === 'string' && !value.trim())) {
    throw new ApiError(422, `${label} is required`);
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new ApiError(422, `${label} must be a valid number`);
  return parsed;
}

function validateMarksConfiguration(total: number, passing: number) {
  if (total <= 0) throw new ApiError(422, 'Total marks must be greater than zero');
  if (passing < 0) throw new ApiError(422, 'Passing marks cannot be negative');
  if (passing > total) throw new ApiError(422, `Passing marks cannot exceed total marks (${formatTotal(total)})`);
}

function formatTotal(total: number) {
  return Number.isInteger(total) ? String(total) : String(Number(total.toFixed(2)));
}

/**
 * Decimal marks are supported because both marks columns use SQLite REAL values.
 * An empty mark intentionally remains null (not zero) until the teacher enters it.
 */
function parseObtainedMark(value: unknown, total: number) {
  if (value === null || value === undefined || value === '' || (typeof value === 'string' && !value.trim())) return null;
  if (typeof value === 'boolean') throw new ApiError(422, 'Obtained marks must be a valid number');
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new ApiError(422, 'Obtained marks must be a valid number');
  if (parsed < 0) throw new ApiError(422, 'Obtained marks cannot be negative');
  if (parsed > total) throw new ApiError(422, `Obtained marks cannot exceed total marks (${formatTotal(total)}).`);
  return parsed;
}

function enrolledStudentIds(sessionId: number, classId: number, sectionId: unknown) {
  const rows = getDatabase().prepare(`
    SELECT student_id FROM enrollments
    WHERE session_id=? AND class_id=? AND section_id IS ? AND status='active'
  `).all(sessionId, classId, sectionId) as { student_id: number }[];
  return new Set(rows.map((row) => row.student_id));
}

export class AssessmentService {
  tests(query: Record<string, unknown>) {
    const { page, limit, offset } = pagination(query as never);
    const where: string[] = ['1=1'];
    const params: unknown[] = [];
    for (const [key, column] of Object.entries({ class_id: 'ct.class_id', section_id: 'ct.section_id', subject_id: 'ct.subject_id', status: 'ct.status' })) {
      if (query[key]) {
        where.push(`${column}=?`);
        params.push(query[key]);
      }
    }
    const db = getDatabase();
    const from = 'FROM class_tests ct JOIN classes c ON c.id=ct.class_id LEFT JOIN sections sec ON sec.id=ct.section_id JOIN subjects sub ON sub.id=ct.subject_id LEFT JOIN staff st ON st.id=ct.teacher_id';
    const total = (db.prepare(`SELECT COUNT(*) total ${from} WHERE ${where.join(' AND ')}`).get(...params) as { total: number }).total;
    const data = db.prepare(`SELECT ct.*,c.name class_name,sec.name section_name,sub.name subject_name,st.first_name || CASE WHEN st.last_name IS NOT NULL THEN ' '||st.last_name ELSE '' END teacher_name ${from} WHERE ${where.join(' AND ')} ORDER BY ct.test_date DESC,ct.id DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
    return { data, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } };
  }

  test(id: number) {
    const db = getDatabase();
    const test = db.prepare(`SELECT ct.*,c.name class_name,sec.name section_name,sub.name subject_name FROM class_tests ct JOIN classes c ON c.id=ct.class_id LEFT JOIN sections sec ON sec.id=ct.section_id JOIN subjects sub ON sub.id=ct.subject_id WHERE ct.id=?`).get(id);
    if (!test) throw new ApiError(404, 'Class test not found');
    return { ...test as object, marks: this.testMarks(id) };
  }

  saveTest(input: Record<string, unknown>, actor: number, id?: number) {
    const db = getDatabase();
    const totalMarks = requiredFiniteNumber(input.total_marks, 'Total marks');
    const passingMarks = requiredFiniteNumber(input.passing_marks, 'Passing marks');
    validateMarksConfiguration(totalMarks, passingMarks);
    const values = [
      required(input.name, 'Test name'),
      String(input.test_date || today()),
      Number(input.session_id) || session(),
      Number(input.class_id),
      nullable(input.section_id),
      Number(input.subject_id),
      nullable(input.teacher_id),
      totalMarks,
      passingMarks,
      number(input.contribution_percent, settingNumber('exam.class_test_weight', 25)),
      input.status === 'published' ? 'published' : 'draft',
      actor
    ];
    if (!values[3] || !values[5]) throw new ApiError(422, 'Class and subject are required');
    if (id) {
      if (!db.prepare('UPDATE class_tests SET name=?,test_date=?,session_id=?,class_id=?,section_id=?,subject_id=?,teacher_id=?,total_marks=?,passing_marks=?,contribution_percent=?,status=? WHERE id=?').run(...values.slice(0, 11), id).changes) {
        throw new ApiError(404, 'Class test not found');
      }
      return this.test(id);
    }
    const result = db.prepare('INSERT INTO class_tests (name,test_date,session_id,class_id,section_id,subject_id,teacher_id,total_marks,passing_marks,contribution_percent,status,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(...values);
    return this.test(Number(result.lastInsertRowid));
  }

  testMarks(id: number) {
    const db = getDatabase();
    const test = db.prepare('SELECT * FROM class_tests WHERE id=?').get(id) as { session_id: number; class_id: number; section_id: number | null } | undefined;
    if (!test) throw new ApiError(404, 'Class test not found');
    return db.prepare(`SELECT s.id student_id,s.admission_no,s.first_name,s.last_name,e.roll_no,ctm.obtained_marks,ctm.remarks FROM enrollments e JOIN students s ON s.id=e.student_id LEFT JOIN class_test_marks ctm ON ctm.student_id=s.id AND ctm.class_test_id=? WHERE e.session_id=? AND e.class_id=? AND e.section_id IS ? AND e.status='active' AND s.status='active' ORDER BY CAST(e.roll_no AS INTEGER),s.first_name`).all(id, test.session_id, test.class_id, test.section_id);
  }

  saveTestMarks(id: number, marks: unknown[], actor: number) {
    if (!Array.isArray(marks)) throw new ApiError(422, 'Marks must be supplied as a list');
    const db = getDatabase();
    const test = db.prepare('SELECT session_id,class_id,section_id,total_marks FROM class_tests WHERE id=?').get(id) as { session_id: number; class_id: number; section_id: number | null; total_marks: number } | undefined;
    if (!test) throw new ApiError(404, 'Class test not found');
    const enrolled = enrolledStudentIds(test.session_id, test.class_id, test.section_id);
    const upsert = db.prepare(`INSERT INTO class_test_marks (class_test_id,student_id,obtained_marks,remarks,entered_by,updated_at) VALUES (?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(class_test_id,student_id) DO UPDATE SET obtained_marks=excluded.obtained_marks,remarks=excluded.remarks,entered_by=excluded.entered_by,updated_at=CURRENT_TIMESTAMP`);

    db.transaction(() => {
      marks.forEach((raw) => {
        const mark = raw as Record<string, unknown>;
        const studentId = Number(mark.student_id);
        if (!Number.isInteger(studentId) || !enrolled.has(studentId)) throw new ApiError(422, 'One or more students are not enrolled for this class test');
        const value = parseObtainedMark(mark.obtained_marks, Number(test.total_marks));
        upsert.run(id, studentId, value, nullable(mark.remarks), actor);
      });
    })();
    return this.test(id);
  }

  publishTest(id: number) {
    if (!getDatabase().prepare("UPDATE class_tests SET status='published' WHERE id=?").run(id).changes) throw new ApiError(404, 'Class test not found');
  }

  exams(query: Record<string, unknown>) {
    const db = getDatabase();
    return db.prepare(`SELECT e.*,et.name exam_type_name,ss.name session_name,(SELECT COUNT(*) FROM exam_subjects es WHERE es.exam_id=e.id) subject_count FROM exams e LEFT JOIN exam_types et ON et.id=e.exam_type_id JOIN school_sessions ss ON ss.id=e.session_id ${query.session_id ? 'WHERE e.session_id=?' : ''} ORDER BY e.created_at DESC`).all(...(query.session_id ? [Number(query.session_id)] : []));
  }

  exam(id: number) {
    const db = getDatabase();
    const exam = db.prepare('SELECT e.*,et.name exam_type_name,ss.name session_name FROM exams e LEFT JOIN exam_types et ON et.id=e.exam_type_id JOIN school_sessions ss ON ss.id=e.session_id WHERE e.id=?').get(id);
    if (!exam) throw new ApiError(404, 'Exam not found');
    return { ...exam as object, subjects: this.examSubjects(id) };
  }

  saveExam(input: Record<string, unknown>, actor: number, id?: number) {
    const db = getDatabase();
    const values = [
      required(input.name, 'Exam name'),
      nullable(input.exam_type_id),
      Number(input.session_id) || session(),
      nullable(input.starts_on),
      nullable(input.ends_on),
      number(input.class_test_weight, settingNumber('exam.class_test_weight', 25)),
      number(input.exam_weight, settingNumber('exam.term_weight', 75)),
      input.status || 'draft',
      actor
    ];
    if (id) {
      if (!db.prepare('UPDATE exams SET name=?,exam_type_id=?,session_id=?,starts_on=?,ends_on=?,class_test_weight=?,exam_weight=?,status=? WHERE id=?').run(...values.slice(0, 8), id).changes) throw new ApiError(404, 'Exam not found');
      return this.exam(id);
    }
    const result = db.prepare('INSERT INTO exams (name,exam_type_id,session_id,starts_on,ends_on,class_test_weight,exam_weight,status,created_by) VALUES (?,?,?,?,?,?,?,?,?)').run(...values);
    return this.exam(Number(result.lastInsertRowid));
  }

  examSubjects(examId: number) {
    return getDatabase().prepare(`SELECT es.*,c.name class_name,sec.name section_name,sub.name subject_name,sub.code subject_code,st.first_name || CASE WHEN st.last_name IS NOT NULL THEN ' '||st.last_name ELSE '' END teacher_name FROM exam_subjects es JOIN classes c ON c.id=es.class_id LEFT JOIN sections sec ON sec.id=es.section_id JOIN subjects sub ON sub.id=es.subject_id LEFT JOIN staff st ON st.id=es.teacher_id WHERE es.exam_id=? ORDER BY c.name,sec.name,sub.name`).all(examId);
  }

  saveExamSubject(examId: number, input: Record<string, unknown>, id?: number) {
    const db = getDatabase();
    if (!db.prepare('SELECT 1 FROM exams WHERE id=?').get(examId)) throw new ApiError(404, 'Exam not found');
    const totalMarks = requiredFiniteNumber(input.total_marks ?? 100, 'Total marks');
    const passingMarks = requiredFiniteNumber(input.passing_marks ?? 40, 'Passing marks');
    validateMarksConfiguration(totalMarks, passingMarks);
    const values = [examId, Number(input.class_id), nullable(input.section_id), Number(input.subject_id), nullable(input.teacher_id), nullable(input.exam_date), totalMarks, passingMarks];
    if (!values[1] || !values[3]) throw new ApiError(422, 'Class and subject are required');
    if (id) {
      if (!db.prepare('UPDATE exam_subjects SET class_id=?,section_id=?,subject_id=?,teacher_id=?,exam_date=?,total_marks=?,passing_marks=? WHERE id=? AND exam_id=?').run(...values.slice(1), id, examId).changes) throw new ApiError(404, 'Exam subject not found');
      return db.prepare('SELECT * FROM exam_subjects WHERE id=?').get(id);
    }
    const result = db.prepare('INSERT INTO exam_subjects (exam_id,class_id,section_id,subject_id,teacher_id,exam_date,total_marks,passing_marks) VALUES (?,?,?,?,?,?,?,?)').run(...values);
    return db.prepare('SELECT * FROM exam_subjects WHERE id=?').get(result.lastInsertRowid);
  }

  marks(examSubjectId: number) {
    const db = getDatabase();
    const subject = db.prepare('SELECT * FROM exam_subjects WHERE id=?').get(examSubjectId) as { id: number; exam_id: number; class_id: number; section_id: number | null; total_marks: number } | undefined;
    if (!subject) throw new ApiError(404, 'Exam subject not found');
    const exam = db.prepare('SELECT session_id FROM exams WHERE id=?').get(subject.exam_id) as { session_id: number };
    return db.prepare(`SELECT s.id student_id,s.admission_no,s.first_name,s.last_name,e.roll_no,em.obtained_marks,em.remarks FROM enrollments e JOIN students s ON s.id=e.student_id LEFT JOIN exam_marks em ON em.student_id=s.id AND em.exam_subject_id=? WHERE e.session_id=? AND e.class_id=? AND e.section_id IS ? AND e.status='active' AND s.status='active' ORDER BY CAST(e.roll_no AS INTEGER),s.first_name`).all(examSubjectId, exam.session_id, subject.class_id, subject.section_id);
  }

  saveMarks(examSubjectId: number, marks: unknown[], actor: number) {
    if (!Array.isArray(marks)) throw new ApiError(422, 'Marks must be supplied as a list');
    const db = getDatabase();
    const subject = db.prepare('SELECT es.exam_id,es.class_id,es.section_id,es.total_marks,e.session_id FROM exam_subjects es JOIN exams e ON e.id=es.exam_id WHERE es.id=?').get(examSubjectId) as { exam_id: number; class_id: number; section_id: number | null; total_marks: number; session_id: number } | undefined;
    if (!subject) throw new ApiError(404, 'Exam subject not found');
    const enrolled = enrolledStudentIds(subject.session_id, subject.class_id, subject.section_id);
    const upsert = db.prepare(`INSERT INTO exam_marks (exam_subject_id,student_id,obtained_marks,remarks,entered_by,updated_at) VALUES (?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(exam_subject_id,student_id) DO UPDATE SET obtained_marks=excluded.obtained_marks,remarks=excluded.remarks,entered_by=excluded.entered_by,updated_at=CURRENT_TIMESTAMP`);

    db.transaction(() => {
      marks.forEach((raw) => {
        const mark = raw as Record<string, unknown>;
        const studentId = Number(mark.student_id);
        if (!Number.isInteger(studentId) || !enrolled.has(studentId)) throw new ApiError(422, 'One or more students are not enrolled for this exam subject');
        const value = parseObtainedMark(mark.obtained_marks, Number(subject.total_marks));
        upsert.run(examSubjectId, studentId, value, nullable(mark.remarks), actor);
      });
    })();
    return this.marks(examSubjectId);
  }

  transition(examId: number, action: 'submit' | 'approve' | 'publish', actor: number) {
    const db = getDatabase();
    const exam = db.prepare('SELECT status FROM exams WHERE id=?').get(examId) as { status: string } | undefined;
    if (!exam) throw new ApiError(404, 'Exam not found');
    const allowed = { submit: ['draft', 'marks_entry'], approve: ['submitted'], publish: ['approved'] } as Record<string, string[]>;
    if (!allowed[action].includes(exam.status)) throw new ApiError(422, `This exam cannot be ${action}ed from its current status`);
    if (action === 'approve') db.prepare("UPDATE exams SET status='approved',approved_by=?,approved_at=CURRENT_TIMESTAMP WHERE id=?").run(actor, examId);
    else db.prepare('UPDATE exams SET status=? WHERE id=?').run(action === 'submit' ? 'submitted' : 'published', examId);
    return this.exam(examId);
  }

  results(examId: number, classId: number, sectionId: number | null) {
    return new ResultService().classResults(examId, classId, sectionId);
  }
}
