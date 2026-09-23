// src/lib/drive/client-cache.ts
//
// Browser-side cache of Drive folder trees (stale-while-revalidate): going
// back to a client you've already opened paints instantly from here while
// the fresh tree loads in the background. Memory first, sessionStorage as a
// second tier so a page reload in the same tab is instant too.
//
// Only index-backed trees are cached: their URLs are HMAC links valid for
// 12h+, so anything younger than MAX_AGE_MS is still fully usable.

const MAX_AGE_MS = 5 * 60 * 60 * 1000;
const STORAGE_PREFIX = 'drive-tree:';
const MAX_STORED_CHARS = 3_000_000; // stay well under the ~5MB sessionStorage quota

const memory = new Map<string, { at: number; data: any }>();

export function getCachedTree(key: string): any | null {
  const now = Date.now();
  const hit = memory.get(key);
  if (hit && now - hit.at < MAX_AGE_MS) return hit.data;
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; data: any };
    if (now - parsed.at >= MAX_AGE_MS) return null;
    memory.set(key, parsed);
    return parsed.data;
  } catch {
    return null;
  }
}

export function setCachedTree(key: string, data: any): void {
  if (!data || data._source !== 'index') return;
  const entry = { at: Date.now(), data };
  memory.set(key, entry);
  if (typeof window === 'undefined') return;
  try {
    const raw = JSON.stringify(entry);
    if (raw.length > MAX_STORED_CHARS) {
      window.sessionStorage.removeItem(STORAGE_PREFIX + key);
      return;
    }
    window.sessionStorage.setItem(STORAGE_PREFIX + key, raw);
  } catch {
    /* quota or private mode — memory cache still works */
  }
}

export function clearCachedTrees(): void {
  memory.clear();
  if (typeof window === 'undefined') return;
  try {
    for (let i = window.sessionStorage.length - 1; i >= 0; i--) {
      const k = window.sessionStorage.key(i);
      if (k?.startsWith(STORAGE_PREFIX)) window.sessionStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
}
