import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { fork, ChildProcess } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

let mainWindow: BrowserWindow | null = null;
let apiProcess: ChildProcess | null = null;
let isQuitting = false;
const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
const desktopUrl = 'http://127.0.0.1:3299';

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1120,
    minHeight: 700,
    backgroundColor: '#f6f8f7',
    title: 'School ERP',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  const url = process.env.VITE_DEV_SERVER_URL;
  await mainWindow.loadURL(url || desktopUrl);
  mainWindow.on('closed', () => { mainWindow = null; });
}

function startApi() {
  if (isDev) return;
  const appRoot = app.isPackaged ? path.join(process.resourcesPath, 'app.asar') : path.resolve(__dirname, '../..');
  const serverFile = path.join(appRoot, 'release/server/index.js');
  const dataDir = app.getPath('userData');
  apiProcess = fork(serverFile, [], {
    env: {
      ...process.env,
      PORT: '3299',
      DATABASE_PATH: path.join(dataDir, 'school.db'),
      UPLOAD_DIR: path.join(dataDir, 'uploads'),
      BACKUP_DIR: path.join(dataDir, 'backups'),
      RENDERER_DIR: path.join(appRoot, 'release/renderer'),
      SERVE_RENDERER: 'true',
      ELECTRON_RUN_AS_NODE: '1'
    },
    silent: true
  });
  apiProcess.stdout?.on('data', (chunk) => console.log(`[School ERP API] ${chunk}`));
  apiProcess.stderr?.on('data', (chunk) => console.error(`[School ERP API] ${chunk}`));
  apiProcess.on('error', (error) => console.error('[School ERP API] Failed to start', error));
  apiProcess.on('exit', (code, signal) => {
    if (!isQuitting) console.error(`[School ERP API] Stopped unexpectedly (code=${code}, signal=${signal})`);
  });
}

async function waitForApi(timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${desktopUrl}/api/auth/me`);
      if (response.status > 0) return;
    } catch {
      // The API is still applying migrations or starting its HTTP listener.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('The local School ERP API did not become ready in time.');
}

ipcMain.handle('desktop:save-pdf', async (_event, html: string, suggestedName = 'report.pdf', landscape = false) => {
  const printWindow = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
  await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  const pdf = await printWindow.webContents.printToPDF({ printBackground: true, pageSize: 'A4', landscape });
  const result = await dialog.showSaveDialog({ defaultPath: suggestedName, filters: [{ name: 'PDF', extensions: ['pdf'] }] });
  if (!result.canceled && result.filePath) await fs.writeFile(result.filePath, pdf);
  printWindow.destroy();
  return { canceled: result.canceled, filePath: result.filePath };
});

ipcMain.handle('desktop:open-print-preview', async (_event, html: string, title = 'School ERP Print Preview', landscape = false) => {
  const preview = new BrowserWindow({
    width: landscape ? 1240 : 930,
    height: 880,
    minWidth: 720,
    minHeight: 600,
    title,
    backgroundColor: '#eef2ef',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  await preview.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  return true;
});

ipcMain.handle('desktop:open-external', (_event, url: string) => shell.openExternal(url));

app.whenReady().then(async () => {
  startApi();
  if (!isDev) {
    try {
      await waitForApi();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The local API could not start.';
      dialog.showErrorBox('School ERP could not start', `${message}\n\nClose the application and try again.`);
      app.quit();
      return;
    }
  }
  await createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) void createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => { isQuitting = true; apiProcess?.kill(); });
