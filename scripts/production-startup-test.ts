import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { fileUrlPathname, hashRouteFromFileUrl, resolveRendererIndex, resolveServerEntry, resolveWindowTarget } from '../electron/runtime';
import { resolveApiBaseUrl, resolveAssetUrl } from '../src/services/runtime';
import { financeActionLabel } from '../src/utils/finance';
import { certificateTitle } from '../src/utils/certificate';

const root = process.cwd();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function staticChecks() {
  const appSource = await fs.readFile(path.join(root, 'src/App.tsx'), 'utf8');
  assert(appSource.includes('HashRouter'), 'The renderer still uses BrowserRouter. Packaged file:// URLs would show Page not found.');
  assert(!appSource.includes('BrowserRouter'), 'BrowserRouter remains in App.tsx and will break packaged Electron routing.');

  const mainSource = await fs.readFile(path.join(root, 'electron/main.ts'), 'utf8');
  assert(mainSource.includes('SERVE_RENDERER'), 'Packaged Electron does not tell Express to serve the renderer.');
  assert(mainSource.includes('resolveWindowTarget'), 'Packaged Electron no longer uses the production window target helper.');

  const packagedPath = fileUrlPathname('C:/Users/School/AppData/Local/Programs/school-erp/resources/app.asar/release/renderer/index.html');
  assert(packagedPath !== '/' && packagedPath !== '/login', 'file:// pathname unexpectedly matches an application route');
  assert(hashRouteFromFileUrl(`${packagedPath}#/login`) === '/login', 'HashRouter would not recover the login route from a file URL');
  assert(hashRouteFromFileUrl(packagedPath) === '/', 'HashRouter should default to / when no hash is present');

  const target = resolveWindowTarget({
    apiReady: true,
    port: 3299,
    rendererIndex: resolveRendererIndex(path.join(root, 'release/electron'))
  });
  assert(target.mode === 'http' && target.url === 'http://127.0.0.1:3299', 'Production window target is not the local Express origin');

  const fallback = resolveWindowTarget({
    apiReady: false,
    rendererIndex: resolveRendererIndex(path.join(root, 'release/electron'))
  });
  assert(fallback.mode === 'file' && fallback.file.endsWith(`${path.sep}renderer${path.sep}index.html`), 'file:// fallback does not point at the packaged renderer');

  assert(resolveApiBaseUrl({ protocol: 'file:', origin: 'null' }) === 'http://127.0.0.1:3299/api', 'file:// API base URL is incorrect');
  assert(resolveApiBaseUrl({ protocol: 'http:', origin: 'http://127.0.0.1:3299' }) === '/api', 'HTTP API base URL should stay same-origin');
  assert(resolveAssetUrl('/uploads/photo.jpg', { protocol: 'file:', origin: 'null' }) === 'http://127.0.0.1:3299/uploads/photo.jpg', 'file:// upload URLs are not rewritten');
  assert(financeActionLabel('income') === 'Add Income' && financeActionLabel('expense') === 'Add Expense', 'Finance action labels are incorrect');
  assert(certificateTitle('character') === 'CHARACTER CERTIFICATE' && certificateTitle('leaving') === 'LEAVING CERTIFICATE', 'Certificate titles are not type-driven');
}

async function compiledChecks() {
  const rendererIndex = path.join(root, 'release/renderer/index.html');
  const serverEntry = resolveServerEntry(path.join(root, 'release/electron'));
  const mainJs = path.join(root, 'release/electron/main.js');
  try {
    await fs.access(rendererIndex);
    await fs.access(serverEntry);
    await fs.access(mainJs);
  } catch {
    console.log('Production startup static checks passed. Compiled release/ is not present yet, so packaged HTTP serving was not executed.');
    return;
  }

  const rendererHtml = await fs.readFile(rendererIndex, 'utf8');
  assert(rendererHtml.includes('School ERP'), 'Built renderer index.html is not the School ERP document');
  assert(!rendererHtml.includes('This workspace page does not exist'), 'Built renderer contains the Not Found copy as its first document');

  const compiledMain = await fs.readFile(mainJs, 'utf8');
  const compiledRuntime = await fs.readFile(path.join(root, 'release/electron/runtime.js'), 'utf8');
  assert(compiledMain.includes('SERVE_RENDERER'), 'Compiled Electron main process does not enable renderer serving');
  assert(compiledRuntime.includes('127.0.0.1') && compiledMain.includes('apiOrigin'), 'Compiled Electron main process does not load the local API origin');

  const port = 3411;
  const tempRoot = path.join(root, 'tmp', 'production-startup');
  await fs.rm(tempRoot, { recursive: true, force: true });
  await fs.mkdir(tempRoot, { recursive: true });
  const child = spawn(process.execPath, [serverEntry], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      SERVE_RENDERER: 'true',
      RENDERER_DIR: path.join(root, 'release/renderer'),
      DATABASE_PATH: path.join(tempRoot, 'school.db'),
      UPLOAD_DIR: path.join(tempRoot, 'uploads'),
      BACKUP_DIR: path.join(tempRoot, 'backups'),
      JWT_SECRET: 'production-startup-secret'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let log = '';
  child.stdout?.on('data', (chunk) => { log += String(chunk); });
  child.stderr?.on('data', (chunk) => { log += String(chunk); });

  try {
    let ready = false;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      try {
        const health = await fetch(`http://127.0.0.1:${port}/api/health`);
        if (health.ok) { ready = true; break; }
      } catch {
        // still booting
      }
      await wait(150);
    }
    assert(ready, `Compiled Express server did not start.\n${log}`);

    const home = await fetch(`http://127.0.0.1:${port}/`);
    const homeHtml = await home.text();
    assert(home.ok && homeHtml.includes('School ERP'), 'Compiled Express did not serve the School ERP renderer at /');
    assert(!homeHtml.includes('This workspace page does not exist'), 'Compiled Express served the Not Found page as the application shell');

    const login = await fetch(`http://127.0.0.1:${port}/login`);
    const loginHtml = await login.text();
    assert(login.ok && loginHtml.includes('School ERP'), 'SPA fallback did not serve index.html for /login');
  } finally {
    child.kill('SIGTERM');
    await wait(250);
    await fs.rm(tempRoot, { recursive: true, force: true });
  }

  console.log('Production startup test passed: HashRouter is in place, packaged paths resolve to the local Express renderer, and the compiled server serves School ERP instead of Page not found.');
}

async function run() {
  await staticChecks();
  await compiledChecks();
  console.log('Production startup checks completed.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
