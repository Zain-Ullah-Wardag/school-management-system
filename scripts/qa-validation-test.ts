import { spawn, type ChildProcess } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import Database from 'better-sqlite3';
import { dateInTimeZone } from '../server/utils/serializers';

const root = process.cwd();
const port = 3403;
const tempDirectory = path.join(root, 'tmp', 'qa-validation-test');
const databasePath = path.join(tempDirectory, 'school.db');

type Payload<T = unknown> = { success: boolean; data?: T; message?: string; details?: Record<string, any> };
const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const assert = (condition: unknown, message: string): asserts condition => { if (!condition) throw new Error(message); };

async function request<T>(method: string, pathName: string, body?: unknown, token?: string) {
  const response = await fetch(`http://127.0.0.1:${port}/api${pathName}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined || method === 'GET' ? undefined : JSON.stringify(body)
  });
  return { status: response.status, payload: await response.json() as Payload<T> };
}

async function waitForServer() {
  for (let attempt = 0; attempt < 240; attempt += 1) {
    try { if ((await request('GET', '/health')).status === 200) return; } catch { /* starting */ }
    await sleep(125);
  }
  throw new Error('QA validation test server failed to start');
}

async function startServer() {
  const output: string[] = [];
  const child = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], {
    cwd: root,
    env: { ...process.env, PORT: String(port), DATABASE_PATH: databasePath, UPLOAD_DIR: path.join(tempDirectory, 'uploads'), JWT_SECRET: 'qa-validation-test-secret' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.on('data', (chunk) => output.push(chunk.toString()));
  child.stderr.on('data', (chunk) => output.push(chunk.toString()));
  try { await waitForServer(); } catch (error) {
    child.kill('SIGTERM');
    throw new Error(`${String(error)}\n${output.join('')}`);
  }
  return child;
}

async function stopServer(child: ChildProcess) {
  if (child.exitCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([new Promise<void>((resolve) => child.once('exit', () => resolve())), sleep(2_000)]);
  if (child.exitCode === null) child.kill('SIGKILL');
}

async function ok<T>(method: string, pathName: string, body: unknown, token: string) {
  const response = await request<T>(method, pathName, body, token);
  assert(response.status >= 200 && response.status < 300 && response.payload.success, `${method} ${pathName} failed: ${response.payload.message || response.status}`);
  return response.payload.data as T;
}

function addDays(date: string, count: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + count);
  return value.toISOString().slice(0, 10);
}

function databaseValue<T>(sql: string, ...params: unknown[]) {
  const database = new Database(databasePath, { readonly: true });
  try { return database.prepare(sql).get(...params) as T; } finally { database.close(); }
}

async function run() {
  assert(dateInTimeZone(new Date('2026-10-04T19:30:00.000Z'), 'Asia/Karachi') === '2026-10-05', 'School date helper failed the Asia/Karachi midnight boundary');
  assert(dateInTimeZone(new Date('2026-10-04T19:30:00.000Z'), 'UTC') === '2026-10-04', 'School date helper failed the UTC boundary');
  await fs.rm(tempDirectory, { recursive: true, force: true });
  await fs.mkdir(tempDirectory, { recursive: true });
  let server: ChildProcess | undefined;
  try {
    server = await startServer();
    const admin = await ok<{ token: string }>('POST', '/auth/login', { username: 'admin', password: 'admin123' }, '');

    // BUG-013: subject marks configuration.
    const invalidSubject = await request('POST', '/academic/subjects', { code: 'INVALID-MARKS', name: 'Invalid Marks', max_marks: 50, pass_marks: 60 }, admin.token);
    assert(invalidSubject.status === 422 && /cannot exceed maximum marks \(50\)/i.test(invalidSubject.payload.message || ''), 'Subject accepted passing marks above its maximum or returned an unclear message');
    assert(databaseValue<{ count: number }>("SELECT COUNT(*) count FROM subjects WHERE code='INVALID-MARKS'").count === 0, 'Rejected subject validation inserted a row');
    const subject = await ok<{ id: number }>('POST', '/academic/subjects', { code: 'QA-MATH', name: 'QA Mathematics', max_marks: 100, pass_marks: 100 }, admin.token);
    const invalidSubjectUpdate = await request('PATCH', `/academic/subjects/${subject.id}`, { code: 'QA-MATH', name: 'QA Mathematics', max_marks: 80, pass_marks: 81 }, admin.token);
    assert(invalidSubjectUpdate.status === 422, 'Subject update accepted passing marks above maximum');
    const storedSubject = databaseValue<{ max_marks: number; pass_marks: number }>('SELECT max_marks,pass_marks FROM subjects WHERE id=?', subject.id);
    assert(storedSubject.max_marks === 100 && storedSubject.pass_marks === 100, 'Rejected subject update changed the stored record');

    // BUG-014: academic session date order.
    const invalidSession = await request('POST', '/academic/sessions', { name: 'Invalid Session', starts_on: '2027-04-01', ends_on: '2027-03-31', is_current: true }, admin.token);
    assert(invalidSession.status === 422 && /end date must be on or after/i.test(invalidSession.payload.message || ''), 'Session accepted an end date before its start date');
    assert(databaseValue<{ count: number }>("SELECT COUNT(*) count FROM school_sessions WHERE name='Invalid Session'").count === 0, 'Rejected session validation inserted a row');
    const validSession = await ok<{ id: number }>('POST', '/academic/sessions', { name: 'One Day Session', starts_on: '2027-04-01', ends_on: '2027-04-01', status: 'planned' }, admin.token);
    const invalidSessionUpdate = await request('PATCH', `/academic/sessions/${validSession.id}`, { name: 'One Day Session', starts_on: '2027-04-02', ends_on: '2027-04-01', status: 'planned', is_current: true }, admin.token);
    assert(invalidSessionUpdate.status === 422, 'Session update accepted reversed dates');
    const storedSession = databaseValue<{ starts_on: string; ends_on: string; is_current: number }>('SELECT starts_on,ends_on,is_current FROM school_sessions WHERE id=?', validSession.id);
    assert(storedSession.starts_on === '2027-04-01' && storedSession.ends_on === '2027-04-01' && storedSession.is_current === 0, 'Rejected session update changed dates or current-session state');

    // BUG-030: timetable period time order.
    const invalidPeriod = await request('POST', '/timetable/periods', { name: 'Invalid Period', sequence: 50, start_time: '10:00', end_time: '09:00', period_type: 'lesson' }, admin.token);
    assert(invalidPeriod.status === 422 && /end time must be after/i.test(invalidPeriod.payload.message || ''), 'Period accepted an end time before its start time');
    const equalPeriod = await request('POST', '/timetable/periods', { name: 'Zero Duration', sequence: 51, start_time: '10:00', end_time: '10:00', period_type: 'lesson' }, admin.token);
    assert(equalPeriod.status === 422, 'Period accepted a zero-duration time range');
    const period = await ok<{ id: number }>('POST', '/timetable/periods', { name: 'Valid Period', sequence: 52, start_time: '10:00', end_time: '10:40', period_type: 'lesson' }, admin.token);
    const invalidPeriodUpdate = await request('PATCH', `/timetable/periods/${period.id}`, { name: 'Valid Period', sequence: 52, start_time: '11:00', end_time: '10:40', period_type: 'lesson' }, admin.token);
    assert(invalidPeriodUpdate.status === 422, 'Period update accepted reversed times');
    const storedPeriod = databaseValue<{ start_time: string; end_time: string }>('SELECT start_time,end_time FROM timetable_periods WHERE id=?', period.id);
    assert(storedPeriod.start_time === '10:00' && storedPeriod.end_time === '10:40', 'Rejected period update changed the stored record');

    const schoolClass = await ok<{ id: number }>('POST', '/academic/classes', { code: 'QA-G10', name: 'Grade 10', display_order: 10 }, admin.token);
    const section = await ok<{ id: number }>('POST', '/academic/sections', { class_id: schoolClass.id, name: 'A' }, admin.token);

    // BUG-048: child subject dates and parent range edits.
    const rangedExam = await ok<{ id: number }>('POST', '/assessments/exams', { name: 'June Range Exam', starts_on: '2026-06-10', ends_on: '2026-06-20' }, admin.token);
    const beforeRange = await request('POST', `/assessments/exams/${rangedExam.id}/subjects`, { class_id: schoolClass.id, section_id: section.id, subject_id: subject.id, exam_date: '2026-06-09', total_marks: 100, passing_marks: 40 }, admin.token);
    assert(beforeRange.status === 422 && /QA Mathematics exam date 2026-06-09/i.test(beforeRange.payload.message || ''), 'Exam subject accepted a date before its parent range');
    assert(databaseValue<{ count: number }>('SELECT COUNT(*) count FROM exam_subjects WHERE exam_id=?', rangedExam.id).count === 0, 'Rejected exam subject created a row');
    const rangedSubject = await ok<{ id: number }>('POST', `/assessments/exams/${rangedExam.id}/subjects`, { class_id: schoolClass.id, section_id: section.id, subject_id: subject.id, exam_date: '2026-06-10', total_marks: 100, passing_marks: 40 }, admin.token);
    await ok('PATCH', `/assessments/exams/${rangedExam.id}/subjects/${rangedSubject.id}`, { class_id: schoolClass.id, section_id: section.id, subject_id: subject.id, exam_date: '2026-06-20', total_marks: 100, passing_marks: 40 }, admin.token);
    const afterRange = await request('PATCH', `/assessments/exams/${rangedExam.id}/subjects/${rangedSubject.id}`, { class_id: schoolClass.id, section_id: section.id, subject_id: subject.id, exam_date: '2026-06-21', total_marks: 100, passing_marks: 40 }, admin.token);
    assert(afterRange.status === 422, 'Exam subject update accepted a date after its parent range');
    assert(databaseValue<{ exam_date: string }>('SELECT exam_date FROM exam_subjects WHERE id=?', rangedSubject.id).exam_date === '2026-06-20', 'Rejected exam-subject update changed its date');
    const excludingParentUpdate = await request('PATCH', `/assessments/exams/${rangedExam.id}`, { name: 'June Range Exam', starts_on: '2026-06-10', ends_on: '2026-06-19', class_test_weight: 25, exam_weight: 75 }, admin.token);
    assert(excludingParentUpdate.status === 422 && /cannot exclude existing subject dates/i.test(excludingParentUpdate.payload.message || ''), 'Parent exam range update stranded an existing subject date');
    assert(databaseValue<{ ends_on: string }>('SELECT ends_on FROM exams WHERE id=?', rangedExam.id).ends_on === '2026-06-20', 'Rejected parent range update changed the exam');

    // BUG-051: approval/publication follows the configured school-local date.
    await ok('PUT', '/settings', { settings: { 'school.timezone': 'UTC' } }, admin.token);
    const context = await ok<{ today: string; timezone: string }>('GET', '/attendance/context', undefined, admin.token);
    assert(context.timezone === 'UTC', 'Configured test timezone was not applied');
    const futureDate = addDays(context.today, 1);
    const roles = await ok<{ id: number; code: string }[]>('GET', '/users/roles', undefined, admin.token);
    const principalRole = roles.find((role) => role.code === 'principal');
    const teacherRole = roles.find((role) => role.code === 'class_teacher');
    assert(principalRole && teacherRole, 'Principal or teacher role is missing');
    await ok('POST', '/users', { full_name: 'QA Principal', username: 'qa-principal', password: 'Temporary123!', role_id: principalRole.id }, admin.token);
    await ok('POST', '/users', { full_name: 'QA Teacher', username: 'qa-teacher', password: 'Temporary123!', role_id: teacherRole.id }, admin.token);
    const principal = await ok<{ token: string }>('POST', '/auth/login', { username: 'qa-principal', password: 'Temporary123!' }, '');
    const teacher = await ok<{ token: string }>('POST', '/auth/login', { username: 'qa-teacher', password: 'Temporary123!' }, '');
    const student = await ok<{ id: number }>('POST', '/students', { admission_no: 'QA-BUG051-001', first_name: 'Maira', last_name: 'Latif', gender: 'female', admission_date: context.today, class_id: schoolClass.id, section_id: section.id, roll_no: '1' }, admin.token);
    const scheduledExam = await ok<{ id: number }>('POST', '/assessments/exams', { name: 'Scheduled Exam', starts_on: context.today, ends_on: futureDate, class_test_weight: 0, exam_weight: 100 }, teacher.token);
    const scheduledSubject = await ok<{ id: number }>('POST', `/assessments/exams/${scheduledExam.id}/subjects`, { class_id: schoolClass.id, section_id: section.id, subject_id: subject.id, exam_date: futureDate, total_marks: 100, passing_marks: 40 }, teacher.token);
    await ok('PUT', `/assessments/exams/${scheduledExam.id}/subjects/${scheduledSubject.id}/marks`, { marks: [{ student_id: student.id, obtained_marks: 0 }] }, teacher.token);
    await ok('POST', `/assessments/exams/${scheduledExam.id}/submit`, {}, teacher.token);
    const earlyApproval = await request('POST', `/assessments/exams/${scheduledExam.id}/approve`, {}, principal.token);
    assert(earlyApproval.status === 422 && earlyApproval.payload.details?.code === 'SUBJECT_EXAM_DATE_NOT_REACHED', 'Principal could approve before the scheduled subject date');
    assert((earlyApproval.payload.message || '').includes(`QA Mathematics (Grade 10/A) — ${futureDate}`) && (earlyApproval.payload.message || '').includes(`School date: ${context.today} (UTC)`), 'Early-approval message did not identify the subject, date, school date, and timezone');
    assert(databaseValue<{ status: string }>('SELECT status FROM exams WHERE id=?', scheduledExam.id).status === 'submitted', 'Rejected early approval changed exam status');

    await ok('PATCH', `/assessments/exams/${scheduledExam.id}/subjects/${scheduledSubject.id}`, { class_id: schoolClass.id, section_id: section.id, subject_id: subject.id, exam_date: context.today, total_marks: 100, passing_marks: 40 }, teacher.token);
    const approved = await ok<{ status: string }>('POST', `/assessments/exams/${scheduledExam.id}/approve`, {}, principal.token);
    assert(approved.status === 'approved', 'Same-day complete exam could not be approved');
    await ok('PATCH', `/assessments/exams/${scheduledExam.id}/subjects/${scheduledSubject.id}`, { class_id: schoolClass.id, section_id: section.id, subject_id: subject.id, exam_date: futureDate, total_marks: 100, passing_marks: 40 }, teacher.token);
    const earlyPublication = await request('POST', `/assessments/exams/${scheduledExam.id}/publish`, {}, principal.token);
    assert(earlyPublication.status === 422 && /cannot be published before/i.test(earlyPublication.payload.message || '') && (earlyPublication.payload.message || '').includes(futureDate), 'Principal could publish before the scheduled subject date');
    assert(databaseValue<{ status: string }>('SELECT status FROM exams WHERE id=?', scheduledExam.id).status === 'approved', 'Rejected early publication changed exam status');
    await ok('PATCH', `/assessments/exams/${scheduledExam.id}/subjects/${scheduledSubject.id}`, { class_id: schoolClass.id, section_id: section.id, subject_id: subject.id, exam_date: context.today, total_marks: 100, passing_marks: 40 }, teacher.token);
    const published = await ok<{ status: string }>('POST', `/assessments/exams/${scheduledExam.id}/publish`, {}, principal.token);
    assert(published.status === 'published', 'Same-day complete exam could not be published');

    console.log('QA validation test passed: subject marks, session dates, period times, exam-subject ranges, and school-timezone approval/publication dates reject invalid writes while valid boundaries and BUG-050 numeric zero continue to work.');
  } finally {
    if (server) await stopServer(server);
    await fs.rm(tempDirectory, { recursive: true, force: true });
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
