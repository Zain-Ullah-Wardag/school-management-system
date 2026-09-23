import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

const port = 3399;
const root = process.cwd();
const tempRoot = path.join(root, 'tmp', 'smoke');
const dbPath = path.join(tempRoot, 'school.db');
const uploadPath = path.join(tempRoot, 'uploads');
let token = '';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function request<T>(method: string, pathName: string, body?: unknown): Promise<T> {
  const response = await fetch(`http://127.0.0.1:${port}/api${pathName}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined || ['GET', 'HEAD'].includes(method) ? undefined : JSON.stringify(body)
  });
  const payload = await response.json() as { success: boolean; data: T; message?: string };
  if (!response.ok || !payload.success) throw new Error(`${method} ${pathName}: ${payload.message || response.statusText}`);
  return payload.data;
}
async function waitForApi() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try { await request('GET', '/health'); return; } catch { await wait(150); }
  }
  throw new Error('Smoke API did not start in time');
}

async function run() {
  await fs.rm(tempRoot, { recursive: true, force: true });
  await fs.mkdir(tempRoot, { recursive: true });
  const child = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], {
    cwd: root,
    env: { ...process.env, PORT: String(port), DATABASE_PATH: dbPath, UPLOAD_DIR: uploadPath, JWT_SECRET: 'smoke-test-secret' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let log = '';
  child.stdout.on('data', (chunk) => { log += chunk.toString(); });
  child.stderr.on('data', (chunk) => { log += chunk.toString(); });
  try {
    await waitForApi();
    const auth = await request<{ token: string }>('POST', '/auth/login', { username: 'admin', password: 'admin123' });
    token = auth.token;

    const schoolClass = await request<{ id: number }>('POST', '/academic/classes', { code: 'SMK-1', name: 'Smoke Class', display_order: 1 });
    const section = await request<{ id: number }>('POST', '/academic/sections', { class_id: schoolClass.id, name: 'A', capacity: 30 });
    const subject = await request<{ id: number }>('POST', '/academic/subjects', { code: 'SMK-MATH', name: 'Smoke Mathematics', max_marks: 100, pass_marks: 40 });
    await request('POST', '/academic/class-subjects', { class_id: schoolClass.id, section_id: section.id, subject_id: subject.id, weekly_periods: 5 });

    const student = await request<{ id: number }>('POST', '/students', { admission_no: 'SMK-001', first_name: 'Smoke', last_name: 'Student', gender: 'female', admission_date: '2026-08-01', class_id: schoolClass.id, section_id: section.id, roll_no: '1', phone: '03000000000', contacts: [{ contact_type: 'father', full_name: 'Smoke Parent', phone: '03000000000', is_primary: true }] });
    await request('POST', '/attendance', { attendance_date: '2026-08-06', class_id: schoolClass.id, section_id: section.id, records: [{ student_id: student.id, status: 'present' }] });

    const heads = await request<{ id: number }[]>('GET', '/fees/heads');
    const invoice = await request<{ id: number }>('POST', '/fees/invoices', { student_id: student.id, issue_date: '2026-08-06', due_date: '2026-08-10', items: [{ fee_head_id: heads[0].id, description: 'Smoke monthly fee', amount: 1000 }] });
    await request('POST', '/fees/payments', { student_id: student.id, amount: 500, payment_date: '2026-08-06', allocations: [{ invoice_id: invoice.id, amount: 500 }] });

    const test = await request<{ id: number }>('POST', '/assessments/tests', { name: 'Smoke Unit Test', test_date: '2026-08-06', class_id: schoolClass.id, section_id: section.id, subject_id: subject.id, total_marks: 20, passing_marks: 8 });
    await request('PUT', `/assessments/tests/${test.id}/marks`, { marks: [{ student_id: student.id, obtained_marks: 18 }] });
    await request('POST', `/assessments/tests/${test.id}/publish`, {});

    const types = await request<{ id: number }[]>('GET', '/academic/exam-types');
    const exam = await request<{ id: number }>('POST', '/assessments/exams', { name: 'Smoke Exam', exam_type_id: types[0].id, starts_on: '2026-08-10', ends_on: '2026-08-10' });
    const examSubject = await request<{ id: number }>('POST', `/assessments/exams/${exam.id}/subjects`, { class_id: schoolClass.id, section_id: section.id, subject_id: subject.id, exam_date: '2026-08-10', total_marks: 100, passing_marks: 40 });
    await request('PUT', `/assessments/exams/${exam.id}/subjects/${examSubject.id}/marks`, { marks: [{ student_id: student.id, obtained_marks: 80 }] });
    await request('POST', `/assessments/exams/${exam.id}/submit`, {});
    await request('POST', `/assessments/exams/${exam.id}/approve`, {});
    await request('POST', `/assessments/exams/${exam.id}/publish`, {});
    const results = await request<{ status: string; percentage: number }[]>('GET', `/assessments/exams/${exam.id}/results?class_id=${schoolClass.id}&section_id=${section.id}`);
    if (!results.length || results[0].status !== 'Pass') throw new Error('Assessment pass calculation returned an unexpected result');
    await request('PUT', `/assessments/exams/${exam.id}/subjects/${examSubject.id}/marks`, { marks: [{ student_id: student.id, obtained_marks: 0 }] });
    const zeroResults = await request<{ status: string; percentage: number; subjects: { status: string }[] }[]>('GET', `/assessments/exams/${exam.id}/results?class_id=${schoolClass.id}&section_id=${section.id}`);
    if (zeroResults[0]?.status !== 'Fail' || zeroResults[0]?.subjects[0]?.status !== 'Fail') throw new Error('A zero-mark result was incorrectly marked Pass');
    await request('PUT', `/assessments/exams/${exam.id}/subjects/${examSubject.id}/marks`, { marks: [{ student_id: student.id, obtained_marks: 80 }] });

    const timetable = await request<{ periods: { id: number; period_type: string }[] }>('GET', '/timetable/settings');
    const lesson = timetable.periods.find((period) => period.period_type === 'lesson');
    if (lesson) await request('POST', '/timetable/entries', { class_id: schoolClass.id, section_id: section.id, weekday: 1, period_id: lesson.id, subject_id: subject.id });
    await request('POST', '/communication/send', { channel: 'sms', student_ids: [student.id], message: 'Smoke test message for {student}' });
    await request('PUT', '/settings', { settings: { 'school.name': 'Smoke Test School', 'attendance.warning_percentage': '75' } });
    await request('GET', '/reports/students');
    await request('GET', '/dashboard');
    console.log('Smoke test passed: authentication, academics, students, attendance, fees, zero-mark result failure logic, assessments, timetable, SMS, settings, reports, and dashboard.');
  } finally {
    child.kill('SIGTERM');
    await wait(250);
    await fs.rm(tempRoot, { recursive: true, force: true });
    if (child.exitCode && child.exitCode !== 0) console.error(log);
  }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
