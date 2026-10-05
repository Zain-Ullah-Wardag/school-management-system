import { spawn, type ChildProcess } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import bcrypt from 'bcrypt';
import Database from 'better-sqlite3';
import { dateInTimeZone } from '../server/utils/serializers';

const root = process.cwd();
const port = 3400;
const tempDirectory = path.join(root, 'tmp', 'auth-user-test');
const databasePath = path.join(tempDirectory, 'school.db');
const uploadsPath = path.join(tempDirectory, 'uploads');

type ResponsePayload<T = unknown> = { success: boolean; data?: T; message?: string };

const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function request<T>(method: string, pathName: string, body?: unknown, token?: string) {
  const response = await fetch(`http://127.0.0.1:${port}/api${pathName}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: body === undefined || method === 'GET' ? undefined : JSON.stringify(body)
  });
  const payload = await response.json() as ResponsePayload<T>;
  return { status: response.status, payload };
}

async function waitForServer() {
  // First-run bcrypt/native initialization can exceed 7.5 seconds on slower
  // Windows machines. Match the smoke test's patient startup behavior so a
  // healthy API is not reported as a false authentication failure.
  for (let attempt = 0; attempt < 240; attempt += 1) {
    try {
      const response = await request('GET', '/health');
      if (response.status === 200) return;
    } catch {
      // The server is still starting.
    }
    await sleep(125);
  }
  throw new Error('Authentication test server failed to start');
}

async function startServer() {
  const logs: string[] = [];
  const child = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      DATABASE_PATH: databasePath,
      UPLOAD_DIR: uploadsPath,
      JWT_SECRET: 'authentication-test-secret'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.on('data', (chunk) => logs.push(chunk.toString()));
  child.stderr.on('data', (chunk) => logs.push(chunk.toString()));
  try {
    await waitForServer();
  } catch (error) {
    child.kill('SIGTERM');
    const detail = logs.join('').trim();
    throw new Error(`${error instanceof Error ? error.message : String(error)}${detail ? `\nServer output:\n${detail}` : ''}`);
  }
  return { process: child, logs };
}

async function stopServer(process: ChildProcess) {
  if (process.exitCode !== null) return;
  process.kill('SIGTERM');
  await Promise.race([
    new Promise<void>((resolve) => process.once('exit', () => resolve())),
    sleep(2_000)
  ]);
  if (process.exitCode === null) process.kill('SIGKILL');
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function addCalendarDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function attendanceCounts(date: string) {
  const db = new Database(databasePath, { readonly: true });
  try {
    return db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM attendance_sessions WHERE attendance_date=?) sessions,
        (SELECT COUNT(*) FROM attendance_records ar JOIN attendance_sessions a ON a.id=ar.attendance_session_id WHERE a.attendance_date=?) records
    `).get(date, date) as { sessions: number; records: number };
  } finally {
    db.close();
  }
}

async function run() {
  const midnightBoundary = new Date('2026-10-04T19:30:00.000Z');
  assert(dateInTimeZone(midnightBoundary, 'Asia/Karachi') === '2026-10-05', 'Asia/Karachi school date did not advance at its local midnight');
  assert(dateInTimeZone(midnightBoundary, 'UTC') === '2026-10-04', 'UTC school date advanced before its own midnight');

  await fs.rm(tempDirectory, { recursive: true, force: true });
  await fs.mkdir(tempDirectory, { recursive: true });
  let activeServer: ChildProcess | undefined;
  const logs: string[] = [];

  try {
    const firstRun = await startServer();
    activeServer = firstRun.process;
    logs.push(...firstRun.logs);

    const emptyUsername = await request('POST', '/auth/login', { username: '', password: 'admin123' });
    assert(emptyUsername.status === 422 && emptyUsername.payload.message === 'Username is required', 'Empty username validation failed');

    const emptyPassword = await request('POST', '/auth/login', { username: 'admin', password: '' });
    assert(emptyPassword.status === 422 && emptyPassword.payload.message === 'Password is required', 'Empty password validation failed');

    const wrongUsername = await request('POST', '/auth/login', { username: 'missing-user', password: 'admin123' });
    assert(wrongUsername.status === 401, 'Wrong username did not return 401');

    const wrongPassword = await request('POST', '/auth/login', { username: 'admin', password: 'not-the-password' });
    assert(wrongPassword.status === 401, 'Wrong password did not return 401');

    const login = await request<{ token: string; user: { id: number; role: string } }>('POST', '/auth/login', { username: 'admin', password: 'admin123' });
    assert(login.status === 200 && login.payload.data?.token, 'Correct administrator credentials did not produce a token');
    assert(login.payload.data?.user.role === 'administrator', 'Bootstrap account does not have the Administrator role');
    const token = login.payload.data!.token;

    const me = await request<{ username: string }>('GET', '/auth/me', undefined, token);
    assert(me.status === 200 && me.payload.data?.username === 'admin', 'JWT-protected /auth/me failed');
    const protectedRoute = await request('GET', '/dashboard', undefined, token);
    assert(protectedRoute.status === 200, 'JWT-protected dashboard failed');
    const unauthenticatedRoute = await request('GET', '/dashboard');
    assert(unauthenticatedRoute.status === 401, 'Protected route accepted a missing token');

    const roles = await request<{ id: number; code: string }[]>('GET', '/users/roles', undefined, token);
    const receptionistRole = roles.payload.data?.find((role) => role.code === 'receptionist');
    const classTeacherRole = roles.payload.data?.find((role) => role.code === 'class_teacher');
    assert(receptionistRole, 'Receptionist role was not seeded');
    assert(classTeacherRole, 'Class Teacher role was not seeded');

    const createUser = await request<{ id: number }>('POST', '/users', {
      full_name: 'Authentication Test User',
      username: 'auth-test-user',
      password: 'Temporary123!',
      role_id: receptionistRole.id,
      status: 'active',
      must_change_password: true
    }, token);
    assert(createUser.status === 201 && createUser.payload.data?.id, 'Administrator could not create a user');

    const createdLogin = await request('POST', '/auth/login', { username: 'auth-test-user', password: 'Temporary123!' });
    assert(createdLogin.status === 200, 'Created user could not log in');

    const deactivate = await request('PATCH', `/users/${createUser.payload.data!.id}`, {
      full_name: 'Authentication Test User',
      username: 'auth-test-user',
      role_id: receptionistRole.id,
      status: 'inactive',
      permissions: []
    }, token);
    assert(deactivate.status === 200, 'Administrator could not deactivate a user');
    const inactiveLogin = await request('POST', '/auth/login', { username: 'auth-test-user', password: 'Temporary123!' });
    assert(inactiveLogin.status === 403, 'Inactive user could still sign in');

    // Regression coverage for BUG-005, BUG-024 and BUG-082: teacher-facing pages need
    // read-only academic selectors, while archiving a linked staff record must
    // revoke both new logins and a token that was issued before the archive.
    // Attendance reads and bulk writes must also remain inside the linked
    // staff member's class/section assignments.
    const teacherStaff = await request<{ id: number }>('POST', '/staff', {
      employee_no: 'AUTH-TCH-001',
      first_name: 'Nadia',
      last_name: 'Siddiqui',
      joining_date: '2026-01-01',
      status: 'active',
      login: {
        username: 'teacher01',
        password: 'Temporary123!',
        role_id: classTeacherRole.id
      }
    }, token);
    assert(teacherStaff.status === 201 && teacherStaff.payload.data?.id, 'Could not create linked teacher staff record');

    const otherTeacher = await request<{ id: number }>('POST', '/staff', {
      employee_no: 'AUTH-TCH-002',
      first_name: 'Amina',
      last_name: 'Khalid G',
      joining_date: '2026-01-01',
      status: 'active'
    }, token);
    assert(otherTeacher.status === 201 && otherTeacher.payload.data?.id, 'Could not create the other section teacher');

    const schoolClass = await request<{ id: number }>('POST', '/academic/classes', {
      code: 'AUTH-G10',
      name: 'Grade 10',
      display_order: 999,
      status: 'active'
    }, token);
    assert(schoolClass.status === 201 && schoolClass.payload.data?.id, 'Could not create teacher access test class');
    const sectionA = await request<{ id: number }>('POST', '/academic/sections', {
      class_id: schoolClass.payload.data!.id,
      name: 'A',
      class_teacher_id: otherTeacher.payload.data!.id,
      status: 'active'
    }, token);
    assert(sectionA.status === 201 && sectionA.payload.data?.id, 'Could not create unassigned Grade 10/A section');
    const sectionB = await request<{ id: number }>('POST', '/academic/sections', {
      class_id: schoolClass.payload.data!.id,
      name: 'B',
      class_teacher_id: teacherStaff.payload.data!.id,
      status: 'active'
    }, token);
    assert(sectionB.status === 201 && sectionB.payload.data?.id, 'Could not create assigned Grade 10/B section');

    const studentA = await request<{ id: number }>('POST', '/students', {
      admission_no: 'AUTH-G10-A-001', first_name: 'Section', last_name: 'A Student', gender: 'female', admission_date: '2026-01-02',
      class_id: schoolClass.payload.data!.id, section_id: sectionA.payload.data!.id, roll_no: '1'
    }, token);
    const studentB = await request<{ id: number }>('POST', '/students', {
      admission_no: 'AUTH-G10-B-001', first_name: 'Section', last_name: 'B Student', gender: 'male', admission_date: '2026-01-02',
      class_id: schoolClass.payload.data!.id, section_id: sectionB.payload.data!.id, roll_no: '1'
    }, token);
    assert(studentA.status === 201 && studentA.payload.data?.id && studentB.status === 201 && studentB.payload.data?.id, 'Could not create section-scoped attendance students');

    const teacherLogin = await request<{ token: string; user: { permissions: string[] } }>('POST', '/auth/login', {
      username: 'teacher01',
      password: 'Temporary123!'
    });
    assert(teacherLogin.status === 200 && teacherLogin.payload.data?.token, 'Linked teacher could not sign in before archive');
    const teacherToken = teacherLogin.payload.data!.token;
    assert(teacherLogin.payload.data!.user.permissions.includes('academic.read'), 'Teacher is missing read-only academic lookup permission');
    assert(!teacherLogin.payload.data!.user.permissions.includes('academic.manage'), 'Teacher incorrectly received academic management permission');

    const teacherClasses = await request<{ id: number }[]>('GET', '/academic/classes', undefined, teacherToken);
    assert(teacherClasses.status === 200 && teacherClasses.payload.data?.some((item) => item.id === schoolClass.payload.data!.id), 'Teacher cannot load class selectors');
    const teacherSections = await request<{ id: number }[]>('GET', `/academic/sections?class_id=${schoolClass.payload.data!.id}`, undefined, teacherToken);
    assert(teacherSections.status === 200 && teacherSections.payload.data?.some((item) => item.id === sectionB.payload.data!.id), 'Teacher cannot load section selectors');

    const attendanceContext = await request<{ today: string; timezone: string }>('GET', '/attendance/context', undefined, teacherToken);
    assert(attendanceContext.status === 200 && /^\d{4}-\d{2}-\d{2}$/.test(attendanceContext.payload.data?.today || ''), 'Teacher could not load the school attendance date');
    assert(attendanceContext.payload.data?.timezone === 'Asia/Karachi', 'Attendance did not use the configured school time zone');
    const schoolToday = attendanceContext.payload.data!.today;
    const futureDate = addCalendarDays(schoolToday, 1);

    const assignedRoster = await request<{ students: { student_id: number }[] }>('GET', `/attendance/roster?class_id=${schoolClass.payload.data!.id}&section_id=${sectionB.payload.data!.id}`, undefined, teacherToken);
    assert(assignedRoster.status === 200 && assignedRoster.payload.data?.students.some((student) => student.student_id === studentB.payload.data!.id), 'teacher01 cannot read assigned Grade 10/B roster');
    const assignedSave = await request('POST', '/attendance', {
      attendance_date: '2026-02-02', class_id: schoolClass.payload.data!.id, section_id: sectionB.payload.data!.id,
      records: [{ student_id: studentB.payload.data!.id, status: 'present' }]
    }, teacherToken);
    assert(assignedSave.status === 200, 'teacher01 cannot save assigned Grade 10/B attendance');

    const forbiddenRoster = await request('GET', `/attendance/roster?class_id=${schoolClass.payload.data!.id}&section_id=${sectionA.payload.data!.id}`, undefined, teacherToken);
    assert(forbiddenRoster.status === 403, 'teacher01 could read unassigned Grade 10/A attendance');
    const forbiddenBulkSave = await request('POST', '/attendance', {
      attendance_date: '2026-02-02', class_id: schoolClass.payload.data!.id, section_id: sectionA.payload.data!.id,
      records: [{ student_id: studentA.payload.data!.id, status: 'absent' }]
    }, teacherToken);
    assert(forbiddenBulkSave.status === 403, 'teacher01 could bulk-save unassigned Grade 10/A attendance');

    const adminRoster = await request<{ attendance_session: { id: number } | null }>('GET', `/attendance/roster?class_id=${schoolClass.payload.data!.id}&section_id=${sectionA.payload.data!.id}`, undefined, token);
    assert(adminRoster.status === 200, 'Administrator lost access to Grade 10/A attendance');
    assert(adminRoster.payload.data?.attendance_session === null, 'Forbidden teacher save created an unassigned Grade 10/A attendance session');
    const adminSave = await request('POST', '/attendance', {
      attendance_date: '2026-02-02', class_id: schoolClass.payload.data!.id, section_id: sectionA.payload.data!.id,
      records: [{ student_id: studentA.payload.data!.id, status: 'present' }]
    }, token);
    assert(adminSave.status === 200, 'Administrator could not save Grade 10/A attendance');

    const teacherTodaySave = await request('POST', '/attendance', {
      attendance_date: schoolToday, class_id: schoolClass.payload.data!.id, section_id: sectionB.payload.data!.id,
      records: [{ student_id: studentB.payload.data!.id, status: 'present' }]
    }, teacherToken);
    assert(teacherTodaySave.status === 200, 'Assigned teacher could not save attendance for the school-local current date');
    const adminTodaySave = await request('POST', '/attendance', {
      attendance_date: schoolToday, class_id: schoolClass.payload.data!.id, section_id: sectionA.payload.data!.id,
      records: [{ student_id: studentA.payload.data!.id, status: 'present' }]
    }, token);
    assert(adminTodaySave.status === 200, 'Administrator could not save attendance for the school-local current date');

    const beforeFutureSave = attendanceCounts(futureDate);
    const teacherFutureSave = await request('POST', '/attendance', {
      attendance_date: futureDate, class_id: schoolClass.payload.data!.id, section_id: sectionB.payload.data!.id,
      records: [{ student_id: studentB.payload.data!.id, status: 'absent' }]
    }, teacherToken);
    assert(teacherFutureSave.status === 422 && teacherFutureSave.payload.message === `Attendance cannot be saved for a future date. Choose ${schoolToday} or an earlier date.`, 'Assigned teacher future attendance was accepted or returned an unclear message');
    const adminFutureSave = await request('POST', '/attendance', {
      attendance_date: futureDate, class_id: schoolClass.payload.data!.id, section_id: sectionA.payload.data!.id,
      records: [{ student_id: studentA.payload.data!.id, status: 'absent' }]
    }, token);
    assert(adminFutureSave.status === 422 && adminFutureSave.payload.message === `Attendance cannot be saved for a future date. Choose ${schoolToday} or an earlier date.`, 'Administrator future attendance was accepted or returned an unclear message');
    const afterFutureSave = attendanceCounts(futureDate);
    assert(afterFutureSave.sessions === beforeFutureSave.sessions && afterFutureSave.records === beforeFutureSave.records, 'Rejected future attendance changed attendance sessions or records');
    const forbiddenAcademicWrite = await request('POST', '/academic/classes', { code: 'NOPE', name: 'Must Not Save' }, teacherToken);
    assert(forbiddenAcademicWrite.status === 403, 'Teacher could modify academic setup with read-only access');

    const archiveTeacher = await request('DELETE', `/staff/${teacherStaff.payload.data!.id}`, undefined, token);
    assert(archiveTeacher.status === 200, 'Administrator could not archive linked teacher');
    const staleTokenRequest = await request('GET', '/students?limit=1', undefined, teacherToken);
    assert(staleTokenRequest.status === 401, 'Archived staff token retained protected access');
    const archivedLogin = await request('POST', '/auth/login', { username: 'teacher01', password: 'Temporary123!' });
    assert(archivedLogin.status === 403, 'Archived staff linked login remained active');

    await stopServer(activeServer);
    activeServer = undefined;

    // Verify bootstrap repair: preserve a non-admin user, remove admin, then restart.
    const db = new Database(databasePath);
    const administrator = db.prepare("SELECT id FROM roles WHERE code='administrator'").get() as { id: number };
    // Simulate an installation created before linked staff logins were
    // deactivated during archive. Startup seeding must repair this mismatch.
    db.prepare("UPDATE users SET status='active' WHERE username='teacher01'").run();
    db.prepare("DELETE FROM attendance_sessions WHERE marked_by=(SELECT id FROM users WHERE username='admin' COLLATE NOCASE)").run();
    db.prepare("DELETE FROM users WHERE username='admin' COLLATE NOCASE").run();
    db.prepare(`INSERT OR IGNORE INTO users (full_name,username,password_hash,role_id,status,must_change_password) VALUES (?,?,?,?,?,0)`)
      .run('Existing Imported User', 'imported-user', bcrypt.hashSync('Imported123!', 12), administrator.id, 'active');
    db.close();

    const repairedRun = await startServer();
    activeServer = repairedRun.process;
    logs.push(...repairedRun.logs);
    const repairedLogin = await request<{ token: string; user: { role: string } }>('POST', '/auth/login', { username: 'admin', password: 'admin123' });
    assert(repairedLogin.status === 200 && repairedLogin.payload.data?.token, 'Missing administrator was not recreated by the seed process');
    assert(repairedLogin.payload.data?.user.role === 'administrator', 'Repaired admin is not an administrator');
    const repairedArchivedLogin = await request('POST', '/auth/login', { username: 'teacher01', password: 'Temporary123!' });
    assert(repairedArchivedLogin.status === 403, 'Startup did not deactivate an existing login linked to archived staff');

    const verifyDb = new Database(databasePath, { readonly: true });
    const admin = verifyDb.prepare(`SELECT u.username,u.password_hash,r.code role FROM users u JOIN roles r ON r.id=u.role_id WHERE u.username='admin' COLLATE NOCASE`).get() as { username: string; password_hash: string; role: string } | undefined;
    verifyDb.close();
    assert(admin && bcrypt.compareSync('admin123', admin.password_hash), 'Seeded admin hash does not match admin123');
    assert(admin.role === 'administrator', 'Seeded admin role is incorrect');

    console.log('Authentication & User Management test passed: validation, bcrypt login, live JWT account checks, teacher read-only academic access, assigned attendance roster enforcement, school-timezone future-date protection with zero writes, linked-staff archive revocation, protected routes, user create/deactivate, and bootstrap recovery.');
  } finally {
    if (activeServer) await stopServer(activeServer);
    await fs.rm(tempDirectory, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
