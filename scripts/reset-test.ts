import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

const root = process.cwd();
const port = 3402;
const temp = path.join(root, 'tmp', 'reset-test');
let token = '';
const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

type Envelope<T> = { success: boolean; data?: T; message?: string };
async function api<T>(method: string, pathname: string, body?: unknown) {
  const response = await fetch(`http://127.0.0.1:${port}/api${pathname}`, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body === undefined || method === 'GET' ? undefined : JSON.stringify(body) });
  const payload = await response.json() as Envelope<T>;
  if (!response.ok || !payload.success) throw new Error(`${method} ${pathname}: ${payload.message || response.statusText}`);
  return payload.data as T;
}
async function waitForServer() { for (let i = 0; i < 60; i += 1) { try { await api('GET', '/health'); return; } catch { await wait(125); } } throw new Error('Reset test server did not start'); }
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }

async function run() {
  await fs.rm(temp, { recursive: true, force: true });
  await fs.mkdir(temp, { recursive: true });
  const child = spawn(process.execPath, [path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'), 'server/index.ts'], { cwd: root, env: { ...process.env, PORT: String(port), DATABASE_PATH: path.join(temp, 'school.db'), UPLOAD_DIR: path.join(temp, 'uploads'), BACKUP_DIR: path.join(temp, 'backups'), JWT_SECRET: 'reset-test-secret' }, stdio: 'ignore' });
  try {
    await waitForServer();
    const login = await api<{ token: string }>('POST', '/auth/login', { username: 'admin', password: 'admin123' });
    token = login.token;
    await api('POST', '/setup/demo', {});
    const reset = await api<{ backup: { file_name: string }; after: { students: number; staff: number; invoices: number } }>('POST', '/system/reset', { mode: 'demo_reset', confirmation: 'RESET SCHOOL DATA' });
    assert(reset.backup.file_name.endsWith('.db'), 'Reset did not create a backup');
    assert(reset.after.students === 0 && reset.after.staff === 0 && reset.after.invoices === 0, 'Demo reset did not clear operational records');
    const relogin = await api<{ token: string }>('POST', '/auth/login', { username: 'admin', password: 'admin123' });
    token = relogin.token;
    const setup = await api<{ can_initialize: boolean; initialized: boolean }>('GET', '/setup/status');
    assert(setup.can_initialize && !setup.initialized, 'Reset did not return to first-install state');
    const backups = await api<{ file_name: string }[]>('GET', '/backups');
    assert(backups.some((item) => item.file_name === reset.backup.file_name), 'Reset backup is not available for recovery');
    await api('POST', '/setup/demo', {});
    const newYear = await api<{ after: { invoices: number; attendance_sessions: number }; backup: { file_name: string } }>('POST', '/system/reset', { mode: 'new_year', confirmation: 'RESET SCHOOL DATA', new_session_name: '2030-2031', starts_on: '2030-04-01', ends_on: '2031-03-31', archive_students: false });
    assert(newYear.after.invoices === 0 && newYear.after.attendance_sessions === 0, 'New-year cleanup did not clear operational records');
    const sessionRows = await api<{ name: string; is_current: number }[]>('GET', '/academic/sessions');
    assert(sessionRows.some((session) => session.name === '2030-2031' && session.is_current === 1), 'New academic session was not created');
    console.log('Reset School Data test passed: automatic backup, demo reset, new-year cleanup, administrator preservation, and clean-state recovery verified.');
  } finally {
    child.kill('SIGTERM');
    await wait(250);
    await fs.rm(temp, { recursive: true, force: true });
  }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
