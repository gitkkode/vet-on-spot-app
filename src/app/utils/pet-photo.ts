import { environment } from '../../environments/environment';

const PHOTO_KEYS = [
  'photoUrl',
  'photoURL',
  'photo',
  'avatarUrl',
  'avatarURL',
  'imageUrl',
  'imageURL',
  'profilePhoto',
  'profilePhotoUrl',
  'profileImage',
  'profileImageUrl',
  'thumbnailUrl',
  'thumbUrl',
  'avatar',
  'image',
] as const;

const CACHE_KEY = 'vos.petPhotoCache.v1';

/** Absolute URL for a pet photo from varied API shapes / relative paths. */
export function resolvePetPhotoUrl(source: unknown): string {
  if (source == null) return '';
  if (typeof source === 'string') return absolutizeMediaUrl(source);

  if (typeof source === 'object') {
    const obj = source as Record<string, unknown>;
    for (const key of PHOTO_KEYS) {
      const v = obj[key];
      if (typeof v === 'string' && v.trim()) return absolutizeMediaUrl(v);
      if (v && typeof v === 'object') {
        const nested = resolvePetPhotoUrl(v);
        if (nested) return nested;
      }
    }
    for (const key of ['url', 'href', 'signedUrl', 'publicUrl', 'downloadUrl']) {
      const v = obj[key];
      if (typeof v === 'string' && v.trim()) return absolutizeMediaUrl(v);
    }

    // Last resort: device cache (covers upload success without GET photoUrl)
    const id = String(obj['id'] || obj['petId'] || '').trim();
    if (id) {
      const cached = getCachedPetPhotoUrl(id);
      if (cached) return cached;
    }
  }
  return '';
}

/** Pull nested `{ pet: {...} }` payloads into a flat pet record. */
export function unwrapPetPayload(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o['pet'] && typeof o['pet'] === 'object') {
    const pet = o['pet'] as Record<string, unknown>;
    return {
      ...o,
      ...pet,
      id: pet['id'] || o['id'] || o['petId'],
    };
  }
  return o;
}

/** Ensure pet records always expose a usable `photoUrl`. */
export function normalizePetRecord<T extends Record<string, unknown>>(pet: T | null | undefined): T | null {
  if (!pet || typeof pet !== 'object') return pet ?? null;
  const flat = unwrapPetPayload(pet) as T;
  const photoUrl = resolvePetPhotoUrl(flat);
  const id = String(flat['id'] || '').trim();
  if (photoUrl) {
    if (id) cachePetPhotoUrl(id, photoUrl);
    return { ...flat, photoUrl } as T;
  }
  const cached = id ? getCachedPetPhotoUrl(id) : '';
  return { ...flat, photoUrl: cached || String(flat['photoUrl'] || '').trim() } as T;
}

export function normalizePetsList(raw: unknown): any[] {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object'
      ? Array.isArray((raw as any).pets)
        ? (raw as any).pets
        : Array.isArray((raw as any).items)
          ? (raw as any).items
          : Array.isArray((raw as any).data)
            ? (raw as any).data
            : []
      : [];
  return list.map((p: any) => normalizePetRecord(unwrapPetPayload(p) || p)).filter(Boolean);
}

export function cachePetPhotoUrl(petId: string, url: string) {
  const id = String(petId || '').trim();
  const value = String(url || '').trim();
  if (!id || !value || typeof localStorage === 'undefined') return;
  try {
    const map = readCache();
    map[id] = value;
    // Cap entries to avoid quota issues
    const keys = Object.keys(map);
    if (keys.length > 40) {
      for (const k of keys.slice(0, keys.length - 40)) delete map[k];
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(map));
  } catch {
    /* quota / private mode */
  }
}

export function getCachedPetPhotoUrl(petId: string): string {
  const id = String(petId || '').trim();
  if (!id || typeof localStorage === 'undefined') return '';
  try {
    return String(readCache()[id] || '').trim();
  } catch {
    return '';
  }
}

export function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

function readCache(): Record<string, string> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function absolutizeMediaUrl(raw: string): string {
  const url = String(raw || '').trim();
  if (!url) return '';
  if (/^(https?:|blob:|data:)/i.test(url)) return url;

  const api = String(environment.apiUrl || '').replace(/\/$/, '');
  const origin = api.replace(/\/api\/v1$/i, '') || api;

  if (url.startsWith('//')) return `https:${url}`;

  // Already an API-relative path
  if (url.startsWith('/api/')) return `${origin}${url}`;
  if (url.startsWith('/')) {
    // Prefer /api/v1 for files/uploads media roots
    if (/^\/(files|uploads|media|storage)\b/i.test(url)) {
      return `${api}${url}`;
    }
    return `${origin}${url}`;
  }

  if (/^(files|uploads|media|storage)\b/i.test(url)) {
    return `${api}/${url.replace(/^\//, '')}`;
  }
  if (/^api\/v1\//i.test(url)) {
    return `${origin}/${url.replace(/^\//, '')}`;
  }
  return `${origin}/${url.replace(/^\//, '')}`;
}

/**
 * Crop a region of an image file to a square JPEG for profile avatars.
 * `region` is in natural image pixels: source x/y/width/height.
 */
export async function cropImageRegionToFile(
  source: Blob,
  region: { sx: number; sy: number; sw: number; sh: number },
  size = 1024,
  quality = 0.9,
  fileName = 'pet-photo.jpg',
): Promise<File> {
  if (typeof document === 'undefined') {
    return new File([source], fileName, { type: source.type || 'image/jpeg' });
  }
  const bitmap = await loadImageBitmap(source as File);
  try {
    const sx = Math.max(0, Math.floor(region.sx));
    const sy = Math.max(0, Math.floor(region.sy));
    const sw = Math.max(1, Math.floor(region.sw));
    const sh = Math.max(1, Math.floor(region.sh));
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No canvas');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, size, size);
    const blob = await canvasToBlob(canvas, 'image/jpeg', quality);
    if (!blob) throw new Error('Encode failed');
    const base = fileName.replace(/\.[^.]+$/, '') || 'pet-photo';
    return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
  } finally {
    bitmap.close?.();
  }
}

/**
 * @deprecated Prefer interactive crop + cropImageRegionToFile.
 * Center-crop any decodable image to a square JPEG.
 */
export async function cropImageToSquareFile(
  file: File,
  size = 1024,
  quality = 0.9,
): Promise<File> {
  if (typeof document === 'undefined') return file;
  try {
    const bitmap = await loadImageBitmap(file);
    const side = Math.min(bitmap.width, bitmap.height);
    const sx = Math.max(0, Math.floor((bitmap.width - side) / 2));
    const sy = Math.max(0, Math.floor((bitmap.height - side) / 2));
    bitmap.close?.();
    return cropImageRegionToFile(file, { sx, sy, sw: side, sh: side }, size, quality, file.name);
  } catch {
    return file;
  }
}

async function loadImageBitmap(file: Blob): Promise<ImageBitmap> {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file);
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not read image'));
      el.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No canvas');
    ctx.drawImage(img, 0, 0);
    return await createImageBitmap(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality));
}
