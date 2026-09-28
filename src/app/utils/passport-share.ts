const KEY = 'vos.passportShares.v1';

export interface CachedPassportShare {
  token: string;
  id?: string;
  expiresAt?: string | null;
  revoked?: boolean;
  passport?: any;
}

function readAll(): Record<string, CachedPassportShare> {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(map: Record<string, CachedPassportShare>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* quota / private mode */
  }
}

export function shareTokenOf(share: any): string {
  const direct = String(share?.token || share?.shareToken || share?.code || share?.publicToken || '').trim();
  if (direct) return direct;
  const url = String(share?.url || share?.shareUrl || share?.link || share?.shareLink || '').trim();
  const fromUrl = url.match(/\/share\/passport\/([^/?#]+)/);
  if (fromUrl?.[1]) {
    try {
      return decodeURIComponent(fromUrl[1]);
    } catch {
      return fromUrl[1];
    }
  }
  return String(share?.id || share?.shareId || '').trim();
}

export function readShareCache(token: string): CachedPassportShare | null {
  const key = String(token || '').trim();
  if (!key) return null;
  const row = readAll()[key];
  return row && typeof row === 'object' ? row : null;
}

export function rememberPassportShare(entry: CachedPassportShare) {
  const token = String(entry?.token || '').trim();
  if (!token) return;
  const map = readAll();
  map[token] = {
    ...map[token],
    ...entry,
    token,
    revoked: false,
  };
  writeAll(map);
}

export function revokeCachedPassportShare(token: string) {
  const key = String(token || '').trim();
  if (!key) return;
  const map = readAll();
  const prev = map[key] || { token: key };
  map[key] = { ...prev, token: key, revoked: true, passport: undefined };
  writeAll(map);
}

export function shareIsClosed(status?: string | null, expiresAt?: string | null, revoked?: boolean): boolean {
  if (revoked) return true;
  const s = String(status || '').toLowerCase();
  if (/revok|expir|cancel|invalid|disabled|inactive|gone/.test(s)) return true;
  if (!expiresAt) return false;
  const t = new Date(expiresAt).getTime();
  return !Number.isNaN(t) && t <= Date.now();
}
