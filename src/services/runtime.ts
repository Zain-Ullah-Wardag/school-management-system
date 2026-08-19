export const DEFAULT_API_PORT = 3299;

type LocationLike = Pick<Location, 'protocol' | 'origin'>;

export function resolveApiBaseUrl(locationLike?: LocationLike | null) {
  const location = locationLike || (typeof window === 'undefined' ? null : window.location);
  if (!location) return '/api';
  if (location.protocol === 'file:') return `http://127.0.0.1:${DEFAULT_API_PORT}/api`;
  return '/api';
}

export function resolveAssetUrl(path?: string | null, locationLike?: LocationLike | null) {
  if (!path) return '';
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  const location = locationLike || (typeof window === 'undefined' ? null : window.location);
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (location?.protocol === 'file:') return `http://127.0.0.1:${DEFAULT_API_PORT}${normalized}`;
  return path;
}
