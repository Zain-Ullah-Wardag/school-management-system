import path from 'path';

export const DEFAULT_API_PORT = 3299;

export type ProductionWindowTarget =
  | { mode: 'dev'; url: string }
  | { mode: 'http'; url: string }
  | { mode: 'file'; file: string };

export function resolveRendererDirectory(electronDirectory: string) {
  return path.resolve(electronDirectory, '../renderer');
}

export function resolveRendererIndex(electronDirectory: string) {
  return path.join(resolveRendererDirectory(electronDirectory), 'index.html');
}

export function resolveServerEntry(electronDirectory: string) {
  return path.resolve(electronDirectory, '../server/index.js');
}

export function apiOrigin(port = DEFAULT_API_PORT) {
  return `http://127.0.0.1:${port}`;
}

export function productionApiPort(env: NodeJS.ProcessEnv = process.env) {
  const parsed = Number(env.PORT || DEFAULT_API_PORT);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_API_PORT;
}

/**
 * Development loads the Vite server. Packaged/production Electron must load the
 * local Express origin so Browser-relative /api and /uploads resolve. file:// is
 * only a last-resort fallback and requires HashRouter.
 */
export function resolveWindowTarget(options: {
  devServerUrl?: string;
  apiReady: boolean;
  port?: number;
  rendererIndex: string;
}): ProductionWindowTarget {
  if (options.devServerUrl) return { mode: 'dev', url: options.devServerUrl };
  if (options.apiReady) return { mode: 'http', url: apiOrigin(options.port || DEFAULT_API_PORT) };
  return { mode: 'file', file: options.rendererIndex };
}

/**
 * Documents the packaged BrowserRouter failure: Electron loadFile() produces a
 * filesystem pathname such as /C:/.../index.html, which never matches `/` or
 * `/login` and falls through to the application's Page not found route.
 */
export function fileUrlPathname(filePath: string) {
  return `/${filePath.replace(/\\/g, '/')}`;
}

export function hashRouteFromFileUrl(fileUrl: string) {
  const hash = fileUrl.split('#')[1];
  if (!hash) return '/';
  return hash.startsWith('/') ? hash : `/${hash}`;
}
