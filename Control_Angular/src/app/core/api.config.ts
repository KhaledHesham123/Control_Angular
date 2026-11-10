export const API_BASE_URL = 'https://shipscontrol.runasp.net/api';
export const FILES_BASE_URL = 'https://shipscontrol.runasp.net';

export function resolveFileUrl(path: string | null | undefined): string | null {
  if (!path) {
    return null;
  }
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${FILES_BASE_URL}${normalized}`;
}
