import { getDatabase } from '../../database';
import { ApiError } from '../utils/errors';

export type SubjectResult = {
  subject_id: number;
  subject_name: string;
  max_marks: number;
  passing_marks: number;
  class_test_percent: number;
  exam_marks: number | null;
  exam_percent: number;
  total_percent: number;
  grade: string;
  gpa: number;
  status: 'Pass' | 'Fail';
  remarks: string | null;
};

type ExamRow = { id: number; session_id: number; name: string; class_test_weight: number; exam_weight: number; status: string };
type SubjectRow = { id: number; subject_id: number; subject_name: string; total_marks: number; passing_marks: number; obtained_marks: number | null; remarks: string | null };

export class ResultService {
  result(examId: number, studentId: number, classId: number, sectionId: number | null) {
    const db = getDatabase();
    const exam = db.prepare('SELECT * FROM exams WHERE id=?').get(examId) as ExamRow | undefined;
    if (!exam) throw new ApiError(404, 'Exam not found');
    const student = db.prepare(`SELECT s.id,s.admission_no,s.first_name,s.last_name,s.photo_path,e.roll_no,c.name class_name,sec.name section_name FROM students s JOIN enrollments e ON e.student_id=s.id AND e.status='active' JOIN classes c ON c.id=e.class_id LEFT JOIN sections sec ON sec.id=e.section_id WHERE s.id=? AND e.class_id=? AND e.section_id IS ?`).get(studentId, classId, sectionId);
    if (!student) throw new ApiError(404, 'Student enrollment not found for this result');

    const subjects = db.prepare(`SELECT es.*,sub.name subject_name,em.obtained_marks,em.remarks FROM exam_subjects es JOIN subjects sub ON sub.id=es.subject_id LEFT JOIN exam_marks em ON em.exam_subject_id=es.id AND em.student_id=? WHERE es.exam_id=? AND es.class_id=? AND es.section_id IS ? ORDER BY sub.name`).all(studentId, examId, classId, sectionId) as SubjectRow[];
    const passing = Number((db.prepare("SELECT value FROM settings WHERE key='school.passing_percentage'").get() as { value: string } | undefined)?.value || 40);
    const details = subjects.map((subject) => this.subjectResult(exam, subject, studentId, classId, sectionId, passing));
    const totalMarks = subjects.reduce((sum, subject) => sum + Number(subject.total_marks || 0), 0);
    const obtainedMarks = subjects.reduce((sum, subject) => sum + Number(subject.obtained_marks ?? 0), 0);
    const percentage = details.length ? details.reduce((sum, subject) => sum + subject.total_percent, 0) / details.length : 0;
    const complete = details.length > 0 && subjects.every((subject) => subject.obtained_marks !== null && subject.obtained_marks !== undefined);
    const status: 'Pass' | 'Fail' = complete && percentage >= passing && details.every((subject) => subject.status === 'Pass') ? 'Pass' : 'Fail';
    const attendance = this.attendance(exam.session_id, studentId);

    return {
      exam,
      student,
      subjects: details,
      total_marks: totalMarks,
      obtained_marks: obtainedMarks,
      percentage: Number(percentage.toFixed(2)),
      grade: this.grade(percentage, passing),
      gpa: Number((details.length ? details.reduce((sum, subject) => sum + subject.gpa, 0) / details.length : 0).toFixed(2)),
      status,
      is_complete: complete,
      attendance
    };
  }

  classResults(examId: number, classId: number, sectionId: number | null) {
    const db = getDatabase();
    const students = db.prepare(`SELECT e.student_id FROM enrollments e JOIN students s ON s.id=e.student_id WHERE e.class_id=? AND e.section_id IS ? AND e.status='active' AND s.status='active' ORDER BY CAST(e.roll_no AS INTEGER),s.first_name`).all(classId, sectionId) as { student_id: number }[];
    const data = students.map(({ student_id }) => this.result(examId, student_id, classId, sectionId));
    data.sort((left, right) => right.percentage - left.percentage);
    let rank = 0;
    let last: number | undefined;
    return data.map((result, index) => {
      if (last === undefined || result.percentage !== last) rank = index + 1;
      last = result.percentage;
      return { ...result, position: rank };
    });
  }

  private subjectResult(exam: ExamRow, subject: SubjectRow, studentId: number, classId: number, sectionId: number | null, passingPercentage: number): SubjectResult {
    const db = getDatabase();
    const tests = db.prepare(`SELECT ctm.obtained_marks,ct.total_marks FROM class_tests ct LEFT JOIN class_test_marks ctm ON ctm.class_test_id=ct.id AND ctm.student_id=? WHERE ct.session_id=? AND ct.class_id=? AND (ct.section_id IS NULL OR ct.section_id IS ?) AND ct.subject_id=? AND ct.status='published'`).all(studentId, exam.session_id, classId, sectionId, subject.subject_id) as { obtained_marks: number | null; total_marks: number }[];
    const completedTests = tests.filter((test) => test.obtained_marks !== null && Number(test.total_marks) > 0);
    const classTestRawPercent = completedTests.length ? completedTests.reduce((sum, test) => sum + Number(test.obtained_marks) * 100 / Number(test.total_marks), 0) / completedTests.length : 0;
    const classTestPercent = classTestRawPercent * Number(exam.class_test_weight) / 100;

    const examMarks = subject.obtained_marks === null || subject.obtained_marks === undefined ? null : Number(subject.obtained_marks);
    const examRawPercent = examMarks === null || Number(subject.total_marks) <= 0 ? 0 : examMarks * 100 / Number(subject.total_marks);
    const examPercent = examRawPercent * Number(exam.exam_weight) / 100;
    const totalPercent = classTestPercent + examPercent;
    const subjectPassPercent = Number(subject.passing_marks) * 100 / Number(subject.total_marks || 1);

    // A missing exam mark, zero mark below pass threshold, or failed weighted
    // total always yields Fail. This prevents empty/0% results being marked Pass.
    const passed = examMarks !== null && examRawPercent >= subjectPassPercent && totalPercent >= passingPercentage;
    return {
      subject_id: subject.subject_id,
      subject_name: subject.subject_name,
      max_marks: Number(subject.total_marks),
      passing_marks: Number(subject.passing_marks),
      class_test_percent: Number(classTestPercent.toFixed(2)),
      exam_marks: examMarks,
      exam_percent: Number(examPercent.toFixed(2)),
      total_percent: Number(totalPercent.toFixed(2)),
      grade: this.grade(totalPercent, passingPercentage),
      gpa: this.gpa(totalPercent, passingPercentage),
      status: passed ? 'Pass' : 'Fail',
      remarks: subject.remarks
    };
  }

  private attendance(sessionId: number, studentId: number) {
    const row = getDatabase().prepare(`SELECT COUNT(*) total,SUM(ar.status IN ('present','late')) present FROM attendance_records ar JOIN attendance_sessions a ON a.id=ar.attendance_session_id WHERE a.session_id=? AND ar.student_id=?`).get(sessionId, studentId) as { total: number; present: number | null };
    return { present_days: row.present || 0, total_days: row.total, percentage: row.total ? Number(((row.present || 0) * 100 / row.total).toFixed(1)) : 0 };
  }

  private grade(value: number, passing: number) {
    if (value >= 90) return 'A+';
    if (value >= 80) return 'A';
    if (value >= 70) return 'B';
    if (value >= 60) return 'C';
    if (value >= 50) return 'D';
    if (value >= passing) return 'E';
    return 'F';
  }

  private gpa(value: number, passing: number) {
    if (value >= 90) return 4;
    if (value >= 80) return 3.7;
    if (value >= 70) return 3.3;
    if (value >= 60) return 3;
    if (value >= 50) return 2;
    if (value >= passing) return 1;
    return 0;
  }
}
