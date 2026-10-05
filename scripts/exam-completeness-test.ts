import { spawn, type ChildProcess } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import Database from 'better-sqlite3';

const root = process.cwd();
const port = 3402;
const tempDirectory = path.join(root, 'tmp', 'exam-completeness-test');
const databasePath = path.join(tempDirectory, 'school.db');

type Payload<T = unknown> = { success: boolean; data?: T; message?: string; details?: { code?: string; missing?: unknown[] } };

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
  throw new Error('Exam completeness test server failed to start');
}

async function startServer() {
  const output: string[] = [];
  const child = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], {
    cwd: root,
    env: { ...globalThis.process.env, PORT: String(port), DATABASE_PATH: databasePath, UPLOAD_DIR: path.join(tempDirectory, 'uploads'), JWT_SECRET: 'exam-completeness-test-secret' },
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

async function stopServer(process: ChildProcess) {
  if (process.exitCode !== null) return;
  process.kill('SIGTERM');
  await Promise.race([new Promise<void>((resolve) => process.once('exit', () => resolve())), sleep(2_000)]);
  if (process.exitCode === null) process.kill('SIGKILL');
}

async function ok<T>(method: string, pathName: string, body: unknown, token: string) {
  const response = await request<T>(method, pathName, body, token);
  assert(response.status >= 200 && response.status < 300 && response.payload.success, `${method} ${pathName} failed: ${response.payload.message || response.status}`);
  return response.payload.data as T;
}

async function run() {
  await fs.rm(tempDirectory, { recursive: true, force: true });
  await fs.mkdir(tempDirectory, { recursive: true });
  let server: ChildProcess | undefined;
  try {
    server = await startServer();
    const admin = await ok<{ token: string }>('POST', '/auth/login', { username: 'admin', password: 'admin123' }, '');
    const roles = await ok<{ id: number; code: string }[]>('GET', '/users/roles', undefined, admin.token);
    const principalRole = roles.find((role) => role.code === 'principal');
    const teacherRole = roles.find((role) => role.code === 'class_teacher');
    assert(principalRole && teacherRole, 'Required principal and teacher roles were not seeded');

    await ok('POST', '/users', { full_name: 'QA Principal', username: 'exam-principal', password: 'Temporary123!', role_id: principalRole.id }, admin.token);
    await ok('POST', '/users', { full_name: 'QA Teacher', username: 'exam-teacher', password: 'Temporary123!', role_id: teacherRole.id }, admin.token);
    const principal = await ok<{ token: string }>('POST', '/auth/login', { username: 'exam-principal', password: 'Temporary123!' }, '');
    const teacher = await ok<{ token: string }>('POST', '/auth/login', { username: 'exam-teacher', password: 'Temporary123!' }, '');

    const schoolClass = await ok<{ id: number }>('POST', '/academic/classes', { code: 'BUG050-G10', name: 'Grade 10', display_order: 10 }, admin.token);
    const section = await ok<{ id: number }>('POST', '/academic/sections', { class_id: schoolClass.id, name: 'A' }, admin.token);
    const subject = await ok<{ id: number }>('POST', '/academic/subjects', { code: 'BUG050-MATH', name: 'Mathematics', max_marks: 100, pass_marks: 40 }, admin.token);
    const maira = await ok<{ id: number }>('POST', '/students', { admission_no: 'REG-BUG050-001', first_name: 'Maira', last_name: 'Latif', gender: 'female', admission_date: '2026-04-01', class_id: schoolClass.id, section_id: section.id, roll_no: '1' }, admin.token);
    const usman = await ok<{ id: number }>('POST', '/students', { admission_no: 'REG-BUG050-002', first_name: 'Usman', last_name: 'Maqsood', gender: 'male', admission_date: '2026-04-01', class_id: schoolClass.id, section_id: section.id, roll_no: '2' }, admin.token);

    const exam = await ok<{ id: number; status: string }>('POST', '/assessments/exams', { name: 'BUG-050 Term Exam', class_test_weight: 0, exam_weight: 100 }, teacher.token);
    const examSubject = await ok<{ id: number }>('POST', `/assessments/exams/${exam.id}/subjects`, { class_id: schoolClass.id, section_id: section.id, subject_id: subject.id, total_marks: 100, passing_marks: 40 }, teacher.token);

    await ok('PUT', `/assessments/exams/${exam.id}/subjects/${examSubject.id}/marks`, { marks: [
      { student_id: maira.id, obtained_marks: '' },
      { student_id: usman.id, obtained_marks: 60 }
    ] }, teacher.token);
    let stored = await ok<{ student_id: number; obtained_marks: number | null }[]>('GET', `/assessments/exams/${exam.id}/subjects/${examSubject.id}/marks`, undefined, teacher.token);
    assert(stored.find((mark) => mark.student_id === maira.id)?.obtained_marks === null, 'Blank mark was not stored as NULL');
    assert(stored.find((mark) => mark.student_id === usman.id)?.obtained_marks === 60, 'Numeric mark was not preserved');

    await ok('PUT', `/assessments/exams/${exam.id}/subjects/${examSubject.id}/marks`, { marks: [{ student_id: maira.id, obtained_marks: 0 }] }, teacher.token);
    stored = await ok('GET', `/assessments/exams/${exam.id}/subjects/${examSubject.id}/marks`, undefined, teacher.token);
    assert(stored.find((mark) => mark.student_id === maira.id)?.obtained_marks === 0, 'A genuine numeric zero was confused with a missing mark');
    await ok('PUT', `/assessments/exams/${exam.id}/subjects/${examSubject.id}/marks`, { marks: [{ student_id: maira.id, obtained_marks: '' }] }, teacher.token);

    const submitted = await ok<{ status: string }>('POST', `/assessments/exams/${exam.id}/submit`, {}, teacher.token);
    assert(submitted.status === 'submitted', 'Teacher could not submit the exam for approval');
    const teacherApproval = await request('POST', `/assessments/exams/${exam.id}/approve`, {}, teacher.token);
    assert(teacherApproval.status === 403, 'Teacher without approval permission could approve the exam');

    const incompleteApproval = await request('POST', `/assessments/exams/${exam.id}/approve`, {}, principal.token);
    assert(incompleteApproval.status === 422, 'Principal approval accepted a missing exam mark');
    assert(incompleteApproval.payload.details?.code === 'INCOMPLETE_EXAM_MARKS' && incompleteApproval.payload.details.missing?.length === 1, 'Approval rejection did not return structured missing-mark details');
    assert(/Maira Latif/.test(incompleteApproval.payload.message || '') && /Mathematics/.test(incompleteApproval.payload.message || ''), 'Approval rejection did not clearly list the affected student and subject');
    const stillSubmitted = await ok<{ status: string }>('GET', `/assessments/exams/${exam.id}`, undefined, principal.token);
    assert(stillSubmitted.status === 'submitted', 'Rejected approval changed exam status');

    await ok('PUT', `/assessments/exams/${exam.id}/subjects/${examSubject.id}/marks`, { marks: [{ student_id: maira.id, obtained_marks: 0 }] }, teacher.token);
    const approved = await ok<{ status: string }>('POST', `/assessments/exams/${exam.id}/approve`, {}, principal.token);
    assert(approved.status === 'approved', 'Principal could not approve complete marks');

    await ok('PUT', `/assessments/exams/${exam.id}/subjects/${examSubject.id}/marks`, { marks: [{ student_id: maira.id, obtained_marks: null }] }, teacher.token);
    const incompletePublication = await request('POST', `/assessments/exams/${exam.id}/publish`, {}, principal.token);
    assert(incompletePublication.status === 422 && /Maira Latif/.test(incompletePublication.payload.message || '') && /Mathematics/.test(incompletePublication.payload.message || ''), 'Publication accepted a missing mark or omitted the affected entry');
    const stillApproved = await ok<{ status: string }>('GET', `/assessments/exams/${exam.id}`, undefined, principal.token);
    assert(stillApproved.status === 'approved', 'Rejected publication changed exam status');

    await ok('PUT', `/assessments/exams/${exam.id}/subjects/${examSubject.id}/marks`, { marks: [{ student_id: maira.id, obtained_marks: 0 }] }, teacher.token);
    const published = await ok<{ status: string }>('POST', `/assessments/exams/${exam.id}/publish`, {}, principal.token);
    assert(published.status === 'published', 'Principal could not publish a complete exam');
    const results = await ok<any[]>('GET', `/assessments/exams/${exam.id}/results?class_id=${schoolClass.id}&section_id=${section.id}`, undefined, principal.token);
    const mairaResult = results.find((result) => result.student.id === maira.id);
    assert(mairaResult?.is_complete === true && mairaResult.obtained_marks === 0 && mairaResult.subjects[0].exam_marks === 0, 'Published numeric zero was not retained as a complete zero-mark result');
    assert(mairaResult.status === 'Fail', 'A complete numeric zero was not calculated as a failing result');

    const legacyExam = await ok<{ id: number }>('POST', '/assessments/exams', { name: 'Existing Published Incomplete Exam', class_test_weight: 0, exam_weight: 100 }, teacher.token);
    const legacySubject = await ok<{ id: number }>('POST', `/assessments/exams/${legacyExam.id}/subjects`, { class_id: schoolClass.id, section_id: section.id, subject_id: subject.id, total_marks: 100, passing_marks: 40 }, teacher.token);
    await ok('PUT', `/assessments/exams/${legacyExam.id}/subjects/${legacySubject.id}/marks`, { marks: [{ student_id: maira.id, obtained_marks: null }, { student_id: usman.id, obtained_marks: 60 }] }, teacher.token);
    const database = new Database(databasePath);
    database.prepare("UPDATE exams SET status='published' WHERE id=?").run(legacyExam.id);
    database.close();
    const legacyResults = await ok<any[]>('GET', `/assessments/exams/${legacyExam.id}/results?class_id=${schoolClass.id}&section_id=${section.id}`, undefined, principal.token);
    const legacyMaira = legacyResults.find((result) => result.student.id === maira.id);
    assert(legacyMaira?.is_complete === false && legacyMaira.obtained_marks === null && legacyMaira.percentage === null && legacyMaira.status === 'Incomplete', 'Existing published blank mark was silently calculated as zero');
    const verify = new Database(databasePath, { readonly: true });
    const legacyRow = verify.prepare('SELECT e.status,em.obtained_marks FROM exams e JOIN exam_subjects es ON es.exam_id=e.id LEFT JOIN exam_marks em ON em.exam_subject_id=es.id AND em.student_id=? WHERE e.id=?').get(maira.id, legacyExam.id) as { status: string; obtained_marks: number | null };
    verify.close();
    assert(legacyRow.status === 'published' && legacyRow.obtained_marks === null, 'Reading an existing published result modified its stored exam or mark');

    console.log('BUG-050 regression test passed: blanks remain NULL, numeric zero remains complete, teacher/principal roles are enforced, incomplete approval/publication lists affected entries, complete publication succeeds, and existing published blanks are not converted or rewritten.');
  } finally {
    if (server) await stopServer(server);
    await fs.rm(tempDirectory, { recursive: true, force: true });
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
