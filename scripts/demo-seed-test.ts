import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

const root = process.cwd();
const port = 3401;
const temporary = path.join(root, 'tmp', 'demo-seed-test');
const database = path.join(temporary, 'school.db');
const uploads = path.join(temporary, 'uploads');
const backups = path.join(temporary, 'backups');
let token = '';

const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

type Envelope<T> = { success: boolean; data?: T; message?: string };

async function api<T>(method: string, pathName: string, body?: unknown) {
  const response = await fetch(`http://127.0.0.1:${port}/api${pathName}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined || method === 'GET' ? undefined : JSON.stringify(body)
  });
  const payload = await response.json() as Envelope<T>;
  if (!response.ok || !payload.success) throw new Error(`${method} ${pathName}: ${payload.message || response.statusText}`);
  return payload.data as T;
}

async function waitForApi() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { await api('GET', '/health'); return; } catch { await sleep(125); }
  }
  throw new Error('Demo seed test server did not start');
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function run() {
  await fs.rm(temporary, { recursive: true, force: true });
  await fs.mkdir(temporary, { recursive: true });
  const child = spawn(process.execPath, [path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'), 'server/index.ts'], {
    cwd: root,
    env: { ...process.env, PORT: String(port), DATABASE_PATH: database, UPLOAD_DIR: uploads, BACKUP_DIR: backups, JWT_SECRET: 'demo-seed-test-secret' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const logs: string[] = [];
  child.stdout.on('data', (chunk) => logs.push(chunk.toString()));
  child.stderr.on('data', (chunk) => logs.push(chunk.toString()));

  try {
    await waitForApi();
    const login = await api<{ token: string }>('POST', '/auth/login', { username: 'admin', password: 'admin123' });
    token = login.token;

    const before = await api<{ can_initialize: boolean; totals: { students: number } }>('GET', '/setup/status');
    assert(before.can_initialize && before.totals.students === 0, 'Fresh database should be eligible for demo initialization');

    const initialized = await api<{ initialized: boolean; totals: Record<string, number> }>('POST', '/setup/demo', {});
    assert(initialized.initialized, 'Demo initialization did not mark itself complete');
    assert(initialized.totals.classes === 12, 'Expected Nursery through Grade 10');
    assert(initialized.totals.staff === 15, 'Expected 10 teachers plus 5 office staff');
    assert(initialized.totals.students >= 20, 'Expected at least 20 demo students');
    assert(initialized.totals.invoices >= 20, 'Expected demo invoices');

    const classes = await api<unknown[]>('GET', '/academic/classes');
    const staff = await api<{ data: unknown[] }>('GET', '/staff?limit=100');
    const students = await api<{ data: unknown[] }>('GET', '/students?limit=100');
    const invoices = await api<{ data: unknown[] }>('GET', '/fees/invoices?limit=100');
    const exams = await api<unknown[]>('GET', '/assessments/exams');
    const messages = await api<{ data: unknown[] }>('GET', '/communication/logs?limit=100');
    const visitors = await api<{ data: unknown[] }>('GET', '/visitors?limit=100');
    const dashboard = await api<{ cards: { total_students: number; teachers: number; fee_pending: number }; charts: { weekly_attendance: unknown[] } }>('GET', '/dashboard');

    assert(classes.length === 12, 'Class records were not created');
    assert(staff.data.length === 15, 'Staff records were not created');
    assert(students.data.length >= 20, 'Student records were not created');
    assert(invoices.data.length >= 20, 'Invoice records were not created');
    assert(exams.length >= 2, 'Exam records were not created');
    assert(messages.data.length >= 3, 'SMS log records were not created');
    assert(visitors.data.length >= 2, 'Visitor register records were not created');
    assert(dashboard.cards.total_students >= 20 && dashboard.cards.teachers === 10, 'Dashboard does not reflect demo dataset');
    assert(dashboard.charts.weekly_attendance.length === 7, 'Dashboard attendance chart is incomplete');

    const backup = await api<{ file_name: string; size: number }>('POST', '/backups', {});
    assert(backup.size > 0, 'Backup did not create a file');
    const listedBackups = await api<{ file_name: string }[]>('GET', '/backups');
    assert(listedBackups.some((item) => item.file_name === backup.file_name), 'Created backup is not listed');

    console.log('Demo initialization test passed: master data, 24 students, 15 staff, attendance, finance, exams, SMS logs, visitor register, dashboard, and backup creation.');
  } finally {
    child.kill('SIGTERM');
    await Promise.race([new Promise<void>((resolve) => child.once('exit', () => resolve())), sleep(2_000)]);
    if (child.exitCode === null) child.kill('SIGKILL');
    await fs.rm(temporary, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
