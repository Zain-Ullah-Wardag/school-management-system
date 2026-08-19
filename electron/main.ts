import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { createRequire } from 'module';
import fs from 'fs/promises';
import path from 'path';
import {
  apiOrigin,
  productionApiPort,
  resolveRendererDirectory,
  resolveRendererIndex,
  resolveServerEntry,
  resolveWindowTarget
} from './runtime';

let mainWindow: BrowserWindow | null = null;
const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
const moduleRequire = createRequire(__filename);

type EmbeddedServer = {
  startServer: (port?: number) => Promise<unknown>;
  stopServer: () => Promise<void>;
};

let embeddedServer: EmbeddedServer | null = null;
let apiReady = false;

function showStartupPage(message: string) {
  if (!mainWindow) return Promise.resolve();
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>School ERP</title>
    <style>html,body{height:100%;margin:0;background:#f6f8f7;font-family:Arial,Helvetica,sans-serif;color:#173425}
    .wrap{min-height:100%;display:flex;align-items:center;justify-content:center}
    .card{max-width:420px;padding:28px 32px;border-radius:20px;background:#fff;box-shadow:0 16px 40px rgba(11,55,32,.08);text-align:center}
    h1{margin:0 0 8px;font-size:22px}p{margin:0;color:#5b7162;line-height:1.5}</style></head>
    <body><div class="wrap"><div class="card"><h1>School ERP</h1><p>${message}</p></div></div></body></html>`;
  return mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
}

async function isApiHealthy(origin: string) {
  try {
    const response = await fetch(`${origin}/api/health`);
    return response.ok;
  } catch {
    return false;
  }
}

async function startApi() {
  if (isDev) return;
  const port = productionApiPort();
  const origin = apiOrigin(port);
  process.env.PORT = String(port);
  process.env.SERVE_RENDERER = 'true';
  process.env.RENDERER_DIR = resolveRendererDirectory(__dirname);
  process.env.DATABASE_PATH = path.join(app.getPath('userData'), 'school.db');
  process.env.UPLOAD_DIR = path.join(app.getPath('userData'), 'uploads');
  process.env.BACKUP_DIR = path.join(app.getPath('userData'), 'backups');
  process.env.SCHOOL_ERP_EMBEDDED = 'true';

  if (await isApiHealthy(origin)) {
    apiReady = true;
    return;
  }

  const serverFile = resolveServerEntry(__dirname);
  const loaded = moduleRequire(serverFile) as EmbeddedServer;
  embeddedServer = loaded;
  await loaded.startServer(port);
  if (!(await isApiHealthy(origin))) {
    throw new Error(`The local School ERP API started but did not become healthy on ${origin}.`);
  }
  apiReady = true;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1120,
    minHeight: 700,
    backgroundColor: '#f6f8f7',
    title: 'School ERP',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.once('ready-to-show', () => mainWindow?.show());
}

async function loadApplication() {
  if (!mainWindow) return;
  const rendererIndex = resolveRendererIndex(__dirname);
  const target = resolveWindowTarget({
    devServerUrl: process.env.VITE_DEV_SERVER_URL,
    apiReady,
    port: productionApiPort(),
    rendererIndex
  });

  if (target.mode === 'dev' || target.mode === 'http') {
    await mainWindow.loadURL(target.url);
    return;
  }

  await mainWindow.loadFile(target.file);
}

async function boot() {
  createWindow();
  await showStartupPage('Starting the local school workspace…');
  try {
    await startApi();
    await loadApplication();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    try {
      const rendererIndex = resolveRendererIndex(__dirname);
      await fs.access(rendererIndex);
      await mainWindow?.loadFile(rendererIndex);
    } catch {
      await showStartupPage('The School ERP workspace could not start. Close any other School ERP window and try again.');
      dialog.showErrorBox('School ERP', `The local school API could not start.\n\n${detail}`);
    }
  }
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

app.whenReady().then(() => {
  void boot();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) void boot(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => { void embeddedServer?.stopServer(); });
