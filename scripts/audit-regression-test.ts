import { spawn, type ChildProcess } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import Database from 'better-sqlite3';
import { obtainedMarksError } from '../src/utils/marks';

const root = process.cwd();
const port = 3404;
const temporary = path.join(root, 'tmp', 'audit-regression');
const databasePath = path.join(temporary, 'school.db');
const uploadsPath = path.join(temporary, 'uploads');
const testDate = '2026-08-10';
let token = '';

type Envelope<T = unknown> = { success: boolean; data?: T; message?: string };

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function request<T>(method: string, pathName: string, body?: unknown, authorization = token) {
  const response = await fetch(`http://127.0.0.1:${port}/api${pathName}`, {
    method,
    headers: { 'content-type': 'application/json', ...(authorization ? { authorization: `Bearer ${authorization}` } : {}) },
    body: body === undefined || method === 'GET' ? undefined : JSON.stringify(body)
  });
  const payload = await response.json() as Envelope<T>;
  return { status: response.status, payload };
}

async function api<T>(method: string, pathName: string, body?: unknown) {
  const result = await request<T>(method, pathName, body);
  if (!result.payload.success || result.status < 200 || result.status >= 300) throw new Error(`${method} ${pathName}: ${result.payload.message || result.status}`);
  return result.payload.data as T;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function enrollmentSnapshot(student: any) {
  return student.enrollments.map((entry: any) => ({
    id: entry.id,
    student_id: entry.student_id,
    session_id: entry.session_id,
    class_id: entry.class_id,
    section_id: entry.section_id,
    roll_no: entry.roll_no,
    started_on: entry.started_on,
    ended_on: entry.ended_on,
    status: entry.status
  }));
}

async function waitForApi() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await request('GET', '/health', undefined, '');
      if (response.status === 200) return;
    } catch {
      // Server is still booting.
    }
    await wait(125);
  }
  throw new Error('Audit regression server did not start');
}

async function stop(process: ChildProcess) {
  if (process.exitCode !== null) return;
  process.kill('SIGTERM');
  await Promise.race([new Promise<void>((resolve) => process.once('exit', () => resolve())), wait(2_000)]);
  if (process.exitCode === null) process.kill('SIGKILL');
}

async function run() {
  await fs.rm(temporary, { recursive: true, force: true });
  await fs.mkdir(temporary, { recursive: true });
  let server: ChildProcess | undefined;

  try {
    server = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], {
      cwd: root,
      env: {
        ...process.env,
        PORT: String(port),
        DATABASE_PATH: databasePath,
        UPLOAD_DIR: uploadsPath,
        JWT_SECRET: 'audit-regression-secret'
      },
      stdio: 'ignore'
    });
    await waitForApi();

    // Fresh login → immediate dashboard data, then a new login with a fresh JWT.
    const firstLogin = await request<{ token: string }>('POST', '/auth/login', { username: 'admin', password: 'admin123' }, '');
    assert(firstLogin.status === 200 && firstLogin.payload.data?.token, 'Fresh administrator login failed');
    token = firstLogin.payload.data.token;
    const firstDashboard = await api<{ cards: Record<string, number> }>('GET', '/dashboard');
    assert(typeof firstDashboard.cards.total_students === 'number' && typeof firstDashboard.cards.today_collection === 'number', 'Dashboard did not return immediate card data after login');
    const secondLogin = await request<{ token: string }>('POST', '/auth/login', { username: 'admin', password: 'admin123' }, '');
    assert(secondLogin.status === 200 && secondLogin.payload.data?.token, 'Second administrator login failed');
    token = secondLogin.payload.data.token;
    const secondDashboard = await api<{ cards: Record<string, number> }>('GET', '/dashboard');
    assert(typeof secondDashboard.cards.fee_pending === 'number', 'Dashboard failed after a second login');

    const schoolClass = await api<{ id: number }>('POST', '/academic/classes', { code: 'AUD-1', name: 'Audit Class', display_order: 1 });
    const section = await api<{ id: number }>('POST', '/academic/sections', { class_id: schoolClass.id, name: 'A', capacity: 30 });
    const subject = await api<{ id: number }>('POST', '/academic/subjects', { code: 'AUD-MATH', name: 'Audit Mathematics', max_marks: 100, pass_marks: 40 });
    const student = await api<{ id: number }>('POST', '/students', {
      admission_no: 'AUD-001', first_name: 'Audit', last_name: 'Student', gender: 'female', admission_date: testDate,
      class_id: schoolClass.id, section_id: section.id, roll_no: '1', phone: '03000000000',
      contacts: [{ contact_type: 'father', full_name: 'Audit Guardian', phone: '03000000000', is_primary: true }]
    });

    // Reproduce BUG-077's valid legacy state: assigned class/section with no roll.
    // The old edit form then sent a temporarily blank section and null roll even
    // though the operator changed only the name.
    const enrollmentSetup = new Database(databasePath);
    enrollmentSetup.prepare(`UPDATE enrollments SET roll_no=NULL WHERE student_id=? AND status='active'`).run(student.id);
    enrollmentSetup.close();
    const beforeNameEdit = await api<any>('GET', `/students/${student.id}`);
    const enrollmentBefore = enrollmentSnapshot(beforeNameEdit);
    assert(beforeNameEdit.section_id === section.id && beforeNameEdit.roll_no === null, 'BUG-077 setup did not preserve the assigned section and blank roll');

    const editedStudent = await api<any>('PATCH', `/students/${student.id}`, {
      first_name: 'Audit احمد',
      class_id: beforeNameEdit.class_id,
      section_id: null,
      session_id: beforeNameEdit.session_id,
      roll_no: null,
      contacts: beforeNameEdit.contacts
    });
    assert(editedStudent.first_name === 'Audit احمد', 'Urdu name-only edit was not saved');
    assert(editedStudent.class_id === schoolClass.id && editedStudent.section_id === section.id && editedStudent.roll_no === null, 'Immediate profile response changed enrollment during a name-only edit');
    assert(JSON.stringify(enrollmentSnapshot(editedStudent)) === JSON.stringify(enrollmentBefore), 'Immediate profile response changed enrollment history during a name-only edit');

    const studentList = await api<{ data: any[] }>('GET', '/students?search=AUD-001');
    const listedStudent = studentList.data.find((entry) => entry.id === student.id);
    assert(listedStudent?.first_name === 'Audit احمد' && listedStudent.class_id === schoolClass.id && listedStudent.section_id === section.id && listedStudent.roll_no === null, 'Student list disagreed with the preserved enrollment after a name-only edit');

    const reopenedStudent = await api<any>('GET', `/students/${student.id}`);
    assert(reopenedStudent.first_name === 'Audit احمد' && reopenedStudent.class_id === schoolClass.id && reopenedStudent.section_id === section.id && reopenedStudent.roll_no === null, 'Reopened student profile disagreed after a name-only edit');
    assert(JSON.stringify(enrollmentSnapshot(reopenedStudent)) === JSON.stringify(enrollmentBefore), 'Reopened student profile changed enrollment history');

    const editedBonafide = await api<any>('GET', `/reports/certificate/${student.id}?type=bonafide`);
    assert(editedBonafide.certificate_values.student_name === 'Audit احمد Student', 'Bonafide certificate missed the Urdu name edit');
    assert(editedBonafide.certificate_values.class === 'Audit Class' && editedBonafide.certificate_values.section === 'A' && editedBonafide.certificate_values.roll_number === '', 'Bonafide certificate disagreed with the preserved class, section, or blank roll');

    // Attendance summary must be a direct aggregate of the saved history rows.
    await api('POST', '/attendance', { attendance_date: '2026-08-10', class_id: schoolClass.id, section_id: section.id, records: [{ student_id: student.id, status: 'present' }] });
    let history = await api<any>('GET', `/attendance/students/${student.id}/history`);
    assert(history.present_days === 1 && history.late_days === 0 && history.percentage === 100 && history.current_status === 'present', 'Present attendance summary is incorrect');
    await api('POST', '/attendance', { attendance_date: '2026-08-10', class_id: schoolClass.id, section_id: section.id, records: [{ student_id: student.id, status: 'absent' }] });
    await api('POST', '/attendance', { attendance_date: '2026-08-11', class_id: schoolClass.id, section_id: section.id, records: [{ student_id: student.id, status: 'leave' }] });
    await api('POST', '/attendance', { attendance_date: '2026-08-12', class_id: schoolClass.id, section_id: section.id, records: [{ student_id: student.id, status: 'late' }] });
    history = await api<any>('GET', `/attendance/students/${student.id}/history`);
    assert(history.marked_days === 3 && history.present_days === 0 && history.absent_days === 1 && history.leave_days === 1 && history.late_days === 1 && history.attended_days === 1 && history.percentage === 33.3 && history.current_status === 'late', 'Attendance history and summary no longer match');

    // Class-test marks: equal-to-total and decimal are valid; over-total and negative are rejected by the API.
    const classTest = await api<{ id: number }>('POST', '/assessments/tests', { name: 'Audit Class Test', test_date: testDate, class_id: schoolClass.id, section_id: section.id, subject_id: subject.id, total_marks: 20, passing_marks: 8 });
    assert(obtainedMarksError(20, 20) === undefined && obtainedMarksError(19.5, 20) === undefined, 'Frontend marks rule rejected a valid equal/decimal mark');
    assert(obtainedMarksError(25, 20) === 'Obtained marks cannot exceed total marks (20).' && obtainedMarksError(-1, 20) === 'Obtained marks cannot be negative.', 'Frontend marks rule did not expose the expected dynamic validation messages');
    await api('PUT', `/assessments/tests/${classTest.id}/marks`, { marks: [{ student_id: student.id, obtained_marks: 20 }] });
    await api('PUT', `/assessments/tests/${classTest.id}/marks`, { marks: [{ student_id: student.id, obtained_marks: 19.5 }] });
    const classOver = await request('PUT', `/assessments/tests/${classTest.id}/marks`, { marks: [{ student_id: student.id, obtained_marks: 25 }] });
    assert(classOver.status === 422 && classOver.payload.message === 'Obtained marks cannot exceed total marks (20).', 'Class-test over-total marks were accepted or had the wrong message');
    const classNegative = await request('PUT', `/assessments/tests/${classTest.id}/marks`, { marks: [{ student_id: student.id, obtained_marks: -1 }] });
    assert(classNegative.status === 422 && classNegative.payload.message === 'Obtained marks cannot be negative', 'Class-test negative marks were accepted');

    // Term-exam marks receive the same validation contract.
    const exam = await api<{ id: number }>('POST', '/assessments/exams', { name: 'Audit Midterm', starts_on: testDate, ends_on: testDate });
    const examSubject = await api<{ id: number }>('POST', `/assessments/exams/${exam.id}/subjects`, { class_id: schoolClass.id, section_id: section.id, subject_id: subject.id, total_marks: 20, passing_marks: 8 });
    await api('PUT', `/assessments/exams/${exam.id}/subjects/${examSubject.id}/marks`, { marks: [{ student_id: student.id, obtained_marks: 20 }] });
    const examOver = await request('PUT', `/assessments/exams/${exam.id}/subjects/${examSubject.id}/marks`, { marks: [{ student_id: student.id, obtained_marks: 25 }] });
    assert(examOver.status === 422 && examOver.payload.message === 'Obtained marks cannot exceed total marks (20).', 'Exam over-total marks were accepted or had the wrong message');
    const examNegative = await request('PUT', `/assessments/exams/${exam.id}/subjects/${examSubject.id}/marks`, { marks: [{ student_id: student.id, obtained_marks: -1 }] });
    assert(examNegative.status === 422 && examNegative.payload.message === 'Obtained marks cannot be negative', 'Exam negative marks were accepted');

    // Finance histories remain separate and the net calculation includes fee collection.
    const heads = await api<{ id: number }[]>('GET', '/fees/heads');
    const invoice = await api<{ id: number }>('POST', '/fees/invoices', { student_id: student.id, issue_date: testDate, due_date: testDate, items: [{ fee_head_id: heads[0].id, description: 'Audit fee', amount: 500 }] });
    await api('POST', '/fees/payments', { student_id: student.id, amount: 500, payment_date: testDate, allocations: [{ invoice_id: invoice.id, amount: 500 }] });
    const income = await api<{ id: number }>('POST', '/fees/income', { income_date: testDate, category: 'Donation', amount: 125, description: 'Audit income' });
    const expense = await api<{ id: number }>('POST', '/fees/expenses', { expense_date: testDate, amount: 30, description: 'Audit expense', payment_method: 'cash' });
    const incomes = await api<{ data: { id: number; category: string }[] }>('GET', `/fees/income?from=${testDate}&to=${testDate}`);
    const expenses = await api<{ data: { id: number; description: string }[] }>('GET', `/fees/expenses?from=${testDate}&to=${testDate}`);
    assert(incomes.data.length === 1 && incomes.data[0].id === income.id && expenses.data.length === 1 && expenses.data[0].id === expense.id, 'Income and expense histories were mixed or filtered incorrectly');
    await api('PATCH', `/fees/income/${income.id}`, { income_date: testDate, category: 'Donation', amount: 140, description: 'Audit income updated' });
    const summary = await api<{ fee_collection: number; other_income: number; expenses: number; net_income: number }>('GET', `/fees/finance-summary?from=${testDate}&to=${testDate}`);
    assert(summary.fee_collection === 500 && summary.other_income === 140 && summary.expenses === 30 && summary.net_income === 610, 'Net income calculation is incorrect');
    await api('DELETE', `/fees/income/${income.id}`);
    await api('DELETE', `/fees/expenses/${expense.id}`);
    const afterDelete = await api<{ fee_collection: number; other_income: number; expenses: number; net_income: number }>('GET', `/fees/finance-summary?from=${testDate}&to=${testDate}`);
    assert(afterDelete.fee_collection === 500 && afterDelete.other_income === 0 && afterDelete.expenses === 0 && afterDelete.net_income === 500, 'Finance edit/delete totals did not refresh correctly');

    // A type-selected certificate returns a type-selected payload; ID Card can no longer fall back to Bonafide.
    const bonafide = await api<any>('GET', `/reports/certificate/${student.id}?type=bonafide`);
    const enrollment = await api<any>('GET', `/reports/certificate/${student.id}?type=enrollment`);
    const idCard = await api<any>('GET', `/reports/certificate/${student.id}?type=id-card`);
    assert(bonafide.type === 'bonafide' && bonafide.certificate_title === 'BONAFIDE CERTIFICATE' && bonafide.certificate_number.startsWith('BON-'), 'Bonafide certificate payload is incorrect');
    assert(enrollment.type === 'enrollment' && enrollment.certificate_title === 'ENROLLMENT CERTIFICATE' && enrollment.certificate_number.startsWith('ENR-') && enrollment.template_body !== bonafide.template_body, 'Enrollment certificate payload is incorrect');
    assert(idCard.type === 'id-card' && idCard.certificate_title === 'STUDENT ID CARD' && idCard.certificate_number.startsWith('ID-') && !idCard.template_body, 'ID Card payload fell back to a certificate template');
    const unsupported = await request('GET', `/reports/certificate/${student.id}?type=unknown`);
    assert(unsupported.status === 422, 'Unsupported certificate type was accepted');

    // Validate the database trigger itself, independent of HTTP validation.
    const direct = new Database(databasePath);
    let databaseGuarded = false;
    try {
      direct.prepare('UPDATE class_test_marks SET obtained_marks=? WHERE class_test_id=? AND student_id=?').run(99, classTest.id, student.id);
    } catch (error) {
      databaseGuarded = /Obtained marks cannot exceed total marks/.test(String(error));
    } finally {
      direct.close();
    }
    assert(databaseGuarded, 'Database marks trigger did not reject an over-total direct write');

    console.log('Audit regression test passed: name-only Urdu student edits preserve list/profile/certificate enrollment data and history; fresh dashboard API session, income/expense CRUD and net totals, centralized certificate types, frontend-backed marks rules/API/database guards, and attendance history summaries.');
  } finally {
    if (server) await stop(server);
    await fs.rm(temporary, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
