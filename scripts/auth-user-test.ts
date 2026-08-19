import { spawn, type ChildProcess } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import bcrypt from 'bcrypt';
import Database from 'better-sqlite3';

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
  for (let attempt = 0; attempt < 60; attempt += 1) {
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
  const child = spawn(process.execPath, [path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'), 'server/index.ts'], {
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
  await waitForServer();
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

async function run() {
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
    assert(receptionistRole, 'Receptionist role was not seeded');

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

    await stopServer(activeServer);
    activeServer = undefined;

    // Verify bootstrap repair: preserve a non-admin user, remove admin, then restart.
    const db = new Database(databasePath);
    const administrator = db.prepare("SELECT id FROM roles WHERE code='administrator'").get() as { id: number };
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

    const verifyDb = new Database(databasePath, { readonly: true });
    const admin = verifyDb.prepare(`SELECT u.username,u.password_hash,r.code role FROM users u JOIN roles r ON r.id=u.role_id WHERE u.username='admin' COLLATE NOCASE`).get() as { username: string; password_hash: string; role: string } | undefined;
    verifyDb.close();
    assert(admin && bcrypt.compareSync('admin123', admin.password_hash), 'Seeded admin hash does not match admin123');
    assert(admin.role === 'administrator', 'Seeded admin role is incorrect');

    console.log('Authentication & User Management test passed: validation, bcrypt login, JWT, protected routes, user create/deactivate, and bootstrap recovery.');
  } finally {
    if (activeServer) await stopServer(activeServer);
    await fs.rm(tempDirectory, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
