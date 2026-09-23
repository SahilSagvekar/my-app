// src/lib/drive/url-tokens.ts
//
// Short-lived HMAC capability tokens for Drive URLs.
//
// The old folder tree presigned an R2 URL for EVERY file (and thumbnail) on
// every load — thousands of sequential SigV4 signatures, which was most of
// what made opening a big client slow. Now the tree carries same-origin
// URLs like /api/drive/file?k=<key>&e=<expiry>&s=<sig> instead. Minting one
// is a single HMAC (microseconds, WebCrypto), and the real R2 presign only
// happens when someone actually clicks that file.
//
// A token is only ever minted for a key the requesting user was already
// allowed to list, so verifying it is the access check — no DB round trip
// per thumbnail or per HLS segment.

export type DriveTokenPurpose = 'file' | 'thumb' | 'hls';

const DEFAULT_TTL_SECONDS = 12 * 60 * 60; // outlives a long-open tab's working day

let cachedKey: { secret: string; key: CryptoKey } | null = null;

function getSecret(): string {
  const secret = process.env.DRIVE_URL_SECRET || process.env.JWT_SECRET || process.env.FILE_SERVER_SECRET;
  if (!secret) throw new Error('DRIVE_URL_SECRET (or JWT_SECRET) is not configured');
  return secret;
}

async function getHmacKey(): Promise<CryptoKey> {
  const secret = getSecret();
  if (cachedKey && cachedKey.secret === secret) return cachedKey.key;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
  cachedKey = { secret, key };
  return key;
}

function toBase64Url(bytes: ArrayBuffer): string {
  let bin = '';
  const view = new Uint8Array(bytes);
  for (let i = 0; i < view.length; i++) bin += String.fromCharCode(view[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array | null {
  try {
    const b64 = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4);
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

function payload(purpose: DriveTokenPurpose, key: string, exp: number): BufferSource {
  return new TextEncoder().encode(`${purpose}\n${key}\n${exp}`) as BufferSource;
}

// Expiry is rounded UP to a 6-hour boundary so the same key produces the
// same URL for hours at a time — otherwise every folder load would mint new
// thumbnail/segment URLs and the browser cache would never hit.
const EXPIRY_BUCKET_SECONDS = 6 * 60 * 60;

export async function signDriveToken(
  purpose: DriveTokenPurpose,
  key: string,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): Promise<{ e: number; s: string }> {
  const minExp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const exp = Math.ceil(minExp / EXPIRY_BUCKET_SECONDS) * EXPIRY_BUCKET_SECONDS;
  const sig = await crypto.subtle.sign('HMAC', await getHmacKey(), payload(purpose, key, exp));
  return { e: exp, s: toBase64Url(sig) };
}

export async function verifyDriveToken(
  purpose: DriveTokenPurpose,
  key: string,
  exp: string | number | null,
  sig: string | null,
): Promise<boolean> {
  if (!key || !exp || !sig) return false;
  const expNum = typeof exp === 'number' ? exp : parseInt(exp, 10);
  if (!Number.isFinite(expNum) || expNum < Math.floor(Date.now() / 1000)) return false;
  const sigBytes = fromBase64Url(sig);
  if (!sigBytes) return false;
  return crypto.subtle.verify('HMAC', await getHmacKey(), sigBytes as BufferSource, payload(purpose, key, expNum));
}

/** Same-origin URL: streams the file (or 302s to an R2 download link with ?dl=1, or to the NAS proxy). */
export async function signedFileUrl(key: string, opts?: { download?: boolean; name?: string }): Promise<string> {
  const { e, s } = await signDriveToken('file', key);
  const params = new URLSearchParams({ k: key, e: String(e), s });
  if (opts?.download) params.set('dl', '1');
  if (opts?.name) params.set('n', opts.name);
  return `/api/drive/file?${params.toString()}`;
}

/** Same-origin thumbnail URL, served straight from the R2 binding. */
export async function signedThumbUrl(key: string, version?: string | null): Promise<string> {
  const { e, s } = await signDriveToken('thumb', key);
  const params = new URLSearchParams({ k: key, e: String(e), s });
  if (version) params.set('v', version);
  return `/api/drive/thumb?${params.toString()}`;
}

/**
 * HLS playlist + sprite URLs for one video's rendition. The token covers the
 * source key AND its rendition prefix, so the playlist/segment routes can
 * locate the files without a DB lookup; the playlist route re-attaches the
 * same token to every segment URI it serves.
 */
export async function signedHlsUrls(sourceKey: string, previewPrefix: string): Promise<{ playlist: string; sprites: string }> {
  const { e, s } = await signDriveToken('hls', `${sourceKey}\n${previewPrefix}`);
  const token = new URLSearchParams({ k: sourceKey, p: previewPrefix, e: String(e), s }).toString();
  return {
    playlist: `/api/drive/hls/index.m3u8?${token}`,
    sprites: `/api/drive/hls/sprite.vtt?${token}`,
  };
}
