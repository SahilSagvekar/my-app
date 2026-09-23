// src/lib/drive/keys.ts
//
// Pure helpers for reasoning about R2 keys in the Drive index. No I/O.
// Paths still equal keys (see the Drive index design notes in
// index-store.ts), so everything here is string work on the key itself.

// App-managed artifacts that live in the same bucket but are never shown in
// Drive. Anything whose FIRST path segment starts with '.' or '__' is
// internal (.thumbnails/, .hls/, __zip-jobs/, __media-previews/, ...).
export function isInternalKey(key: string): boolean {
  const first = key.split('/')[0] || '';
  return first.startsWith('.') || first.startsWith('__');
}

export const THUMBNAIL_PREFIX = '.thumbnails/';
export const HLS_PREFIX = '.hls/';

/** `.thumbnails/<sourceKey>.jpg` -> `<sourceKey>`, else null. */
export function sourceKeyForThumbnail(key: string): string | null {
  if (!key.startsWith(THUMBNAIL_PREFIX) || !key.endsWith('.jpg')) return null;
  return key.slice(THUMBNAIL_PREFIX.length, -'.jpg'.length) || null;
}

export function thumbnailKeyFor(sourceKey: string): string {
  return `${THUMBNAIL_PREFIX}${sourceKey}.jpg`;
}

export function isFolderKey(key: string): boolean {
  return key.endsWith('/');
}

/** Name shown in the UI — last path segment, without the trailing slash for folders. */
export function nameOf(key: string): string {
  const trimmed = key.endsWith('/') ? key.slice(0, -1) : key;
  return trimmed.split('/').pop() || trimmed;
}

/** Parent folder key, always ending in '/', or '' at the bucket root. */
export function parentKeyOf(key: string): string {
  const trimmed = key.endsWith('/') ? key.slice(0, -1) : key;
  const idx = trimmed.lastIndexOf('/');
  return idx === -1 ? '' : trimmed.slice(0, idx + 1);
}

/** Top-level client folder ("Acme Co/"), or '' for keys at the bucket root. */
export function clientPrefixOf(key: string): string {
  const idx = key.indexOf('/');
  return idx === -1 ? '' : key.slice(0, idx + 1);
}

/** Escape a string for use inside a SQL LIKE pattern (backslash is PG's default escape). */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

const MIME_BY_EXT: Record<string, string> = {
  mp4: 'video/mp4', mov: 'video/quicktime', m4v: 'video/x-m4v', webm: 'video/webm',
  mkv: 'video/x-matroska', avi: 'video/x-msvideo', wmv: 'video/x-ms-wmv',
  mts: 'video/mp2t', m2ts: 'video/mp2t', mxf: 'application/mxf',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
  webp: 'image/webp', heic: 'image/heic', svg: 'image/svg+xml',
  mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', aac: 'audio/aac', ogg: 'audio/ogg',
  pdf: 'application/pdf', txt: 'text/plain', csv: 'text/csv',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  zip: 'application/zip', srt: 'application/x-subrip', psd: 'image/vnd.adobe.photoshop',
  prproj: 'application/octet-stream', aep: 'application/octet-stream',
};

export function mimeFromName(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return MIME_BY_EXT[ext] || 'application/octet-stream';
}

const VIDEO_EXT = /\.(mp4|mov|m4v|webm|mkv|avi|wmv|mts|m2ts|mxf)$/i;

export function isVideoName(name: string): boolean {
  return VIDEO_EXT.test(name);
}

/** Raw camera footage lives under `<Client>/raw-footage/...`. */
export function isRawFootageKey(key: string): boolean {
  return key.split('/').slice(1, -1).includes('raw-footage');
}

/** Final deliverables live under `<Client>/outputs/...`. */
export function isOutputKey(key: string): boolean {
  return key.split('/').slice(1, -1).includes('outputs');
}
