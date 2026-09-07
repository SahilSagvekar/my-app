// src/lib/file-server.ts
// Proxy client — main app calls this instead of hitting S3/Drive directly.
// All heavy file operations are forwarded to the dedicated file server via
// a Cloudflare Worker service binding (env.FILE_SERVER) — NOT a public
// fetch() to a *.workers.dev URL. Workers on the same account can't fetch()
// each other's own workers.dev URLs directly (Cloudflare error 1042);
// service bindings route Worker-to-Worker calls directly, bypassing that
// restriction. The hostname in the URL passed to a binding's fetch() is
// never resolved — Cloudflare routes it straight to the bound Worker — so
// "https://e8-file-server" below is a placeholder, only the path/query matter.

import jwt from 'jsonwebtoken';

const FILE_SERVER_SECRET = process.env.FILE_SERVER_SECRET || '';
const FILE_SERVER_ORIGIN = 'https://e8-file-server';

declare global {
  interface CloudflareEnv {
    FILE_SERVER: { fetch: typeof fetch };
  }
}

if (!FILE_SERVER_SECRET && process.env.NODE_ENV === 'production') {
  console.error('❌ FILE_SERVER_SECRET is not set in main app .env');
}

function makeToken(userId: number | string, role: string): string {
  return jwt.sign({ userId: String(userId), role }, FILE_SERVER_SECRET, { expiresIn: '5m' });
}

export function generateFileServerToken(userId: number | string, role: string): string {
  return makeToken(userId, role);
}

async function fsRequest(
  env: CloudflareEnv,
  method: string,
  path: string,
  userId: number | string,
  role: string,
  body?: object,
  queryParams?: Record<string, string>,
): Promise<Response> {
  const token = makeToken(userId, role);
  const url = new URL(`${FILE_SERVER_ORIGIN}${path}`);

  if (queryParams) {
    for (const [k, v] of Object.entries(queryParams)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, v);
    }
  }

  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };

  if (body && method !== 'GET') {
    (options as any).body = JSON.stringify(body);
  }

  return env.FILE_SERVER.fetch(url.toString(), options);
}

export async function getStructure(env: CloudflareEnv, userId: number | string, role: string, prefix: string) {
  const res = await fsRequest(env, 'GET', '/structure', userId, role, undefined, { prefix, role });
  if (!res.ok) {
    const body = await res.text().catch(() => '(could not read body)');
    throw new Error(`File server error: ${res.status} — ${body}`);
  }
  return res.json();
}

export async function searchFiles(env: CloudflareEnv, userId: number | string, role: string, query: string, prefix: string, max = 50) {
  const res = await fsRequest(env, 'GET', '/search', userId, role, undefined, { q: query, prefix, max: String(max), role });
  if (!res.ok) throw new Error(`File server error: ${res.status}`);
  return res.json();
}

export async function presignUpload(env: CloudflareEnv, userId: number | string, role: string, key: string, contentType: string) {
  const res = await fsRequest(env, 'POST', '/presign-upload', userId, role, { key, contentType });
  if (!res.ok) throw new Error(`File server error: ${res.status}`);
  return res.json() as Promise<{ uploadUrl: string; fileUrl: string; key: string }>;
}

export async function presignDownload(env: CloudflareEnv, userId: number | string, role: string, s3Key: string, fileName?: string) {
  const res = await fsRequest(env, 'POST', '/presign-download', userId, role, { s3Key, fileName });
  if (!res.ok) throw new Error(`File server error: ${res.status}`);
  return res.json() as Promise<{ downloadUrl: string }>;
}

// For files deleted from R2 but confirmed backed up to NAS (see the Files &
// Drive NAS-merge feature). Unlike presignDownload, NAS has no native
// presigning, so this returns the raw streamed Response for pass-through —
// see /api/drive/nas-stream, which is what the browser actually hits.
export async function nasDownloadStream(env: CloudflareEnv, userId: number | string, role: string, s3Key: string, fileName?: string): Promise<Response> {
  const res = await fsRequest(env, 'POST', '/nas-download', userId, role, { s3Key, fileName });
  if (!res.ok) throw new Error(`File server error: ${res.status}`);
  return res;
}

export async function streamZip(
  env: CloudflareEnv,
  userId: number | string,
  role: string,
  opts: { keys?: string[]; folderPrefix?: string; zipName?: string },
): Promise<Response> {
  return fsRequest(env, 'POST', '/download-zip', userId, role, opts);
}

export async function deleteItem(env: CloudflareEnv, userId: number | string, role: string, s3Key: string, type: 'file' | 'folder') {
  const res = await fsRequest(env, 'DELETE', '/delete', userId, role, { s3Key, type });
  if (!res.ok) throw new Error(`File server error: ${res.status}`);
  return res.json();
}

export async function moveItem(
  env: CloudflareEnv,
  userId: number | string,
  role: string,
  sourceKey: string,
  destinationFolderKey: string,
  type: 'file' | 'folder',
) {
  const res = await fsRequest(env, 'POST', '/move', userId, role, { sourceKey, destinationFolderKey, type });
  if (!res.ok) throw new Error(`File server error: ${res.status}`);
  return res.json();
}

export async function createFolder(env: CloudflareEnv, userId: number | string, role: string, folderPath: string, folderName: string) {
  const res = await fsRequest(env, 'POST', '/folder', userId, role, { folderPath, folderName });
  if (!res.ok) throw new Error(`File server error: ${res.status}`);
  return res.json();
}

export async function renameFolder(env: CloudflareEnv, userId: number | string, role: string, oldPath: string, newName: string) {
  const res = await fsRequest(env, 'PATCH', '/folder', userId, role, { oldPath, newName });
  if (!res.ok) throw new Error(`File server error: ${res.status}`);
  return res.json();
}

export async function getDriveSignedUrl(env: CloudflareEnv, userId: number | string, role: string, fileId: string): Promise<{ url: string; expiresIn: number }> {
  const res = await fsRequest(env, 'GET', '/drive-signed-url', userId, role, undefined, { fileId });
  if (!res.ok) throw new Error(`File server error: ${res.status}`);
  return res.json();
}

export async function getDriveProxyStream(env: CloudflareEnv, userId: number | string, role: string, fileId: string, range?: string): Promise<Response> {
  const token = makeToken(userId, role);
  const url = `${FILE_SERVER_ORIGIN}/drive-proxy?fileId=${fileId}`;
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (range) headers['Range'] = range;
  return env.FILE_SERVER.fetch(url, { headers });
}

export async function invalidateCache(env: CloudflareEnv, userId: number | string, role: string, prefix?: string) {
  const res = await fsRequest(env, 'POST', '/cache/invalidate', userId, role, { prefix });
  return res.ok;
}

// ─── Fetch with retry ─────────────────────────────────────────────────────
// Wraps env.FILE_SERVER.fetch() with retry + backoff. No AbortSignal timeout
// here — this is a same-account Worker-to-Worker binding call, not a public
// internet hop, so it doesn't need the timeout logic a public-URL fetch did.
async function fetchWithRetry(
  env: CloudflareEnv,
  path: string,
  options: RequestInit,
  maxAttempts = 3,
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await env.FILE_SERVER.fetch(`${FILE_SERVER_ORIGIN}${path}`, options);
    } catch (err: any) {
      lastError = err;
      const backoffMs = Math.pow(2, attempt) * 1000;
      console.warn(
        `[file-server] Error on ${path} attempt ${attempt + 1}/${maxAttempts}. ${attempt < maxAttempts - 1 ? `Retrying in ${backoffMs}ms...` : 'Giving up.'}`,
      );
      if (attempt < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }
  }

  throw lastError || new Error(`File server unreachable after ${maxAttempts} attempts: ${path}`);
}

export async function initiateMultipart(
  env: CloudflareEnv,
  userId: number | string,
  role: string,
  key: string,
  fileType: string,
  fileSize?: number,
): Promise<{ uploadId: string; key: string }> {
  const token = makeToken(userId, role);
  const res = await fetchWithRetry(env, '/multipart/initiate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ key, fileType, fileSize }),
  }, 3);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const error: any = new Error(err.error || `File server initiate failed: ${res.status}`);
    error.Code = err.code; // preserve USE_SINGLE_PUT code
    throw error;
  }
  return res.json();
}

export async function getPartUrl(
  env: CloudflareEnv,
  userId: number | string,
  role: string,
  key: string,
  uploadId: string,
  partNumber: number
): Promise<{ presignedUrl: string }> {
  const token = makeToken(userId, role);
  const res = await fetchWithRetry(env, '/multipart/part-url', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ key, uploadId, partNumber }),
  }, 3);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `File server part-url failed: ${res.status}`);
  }
  return res.json();
}

export async function completeMultipart(
  env: CloudflareEnv,
  userId: number | string,
  role: string,
  key: string,
  uploadId: string,
  parts: Array<{ ETag: string; PartNumber: number }>
): Promise<{ success: boolean; etag?: string; location?: string }> {
  const token = makeToken(userId, role);
  // completeMultipart is the most critical step — more retries than the rest
  const res = await fetchWithRetry(env, '/multipart/complete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ key, uploadId, parts }),
  }, 5); // losing this step after full upload is worst case
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    // Preserve S3 error codes for upstream handling
    const err: any = new Error(data.error || `File server complete failed: ${res.status}`);
    err.Code = data.code;
    err.name = data.code;
    throw err;
  }
  return res.json();
}

export async function abortMultipart(
  env: CloudflareEnv,
  userId: number | string,
  role: string,
  key: string,
  uploadId: string
): Promise<void> {
  const token = makeToken(userId, role);
  const res = await env.FILE_SERVER.fetch(`${FILE_SERVER_ORIGIN}/multipart/abort`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ key, uploadId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `File server abort failed: ${res.status}`);
  }
}
// ─── Drive Mirror Queue ───────────────────────────────────────────────────────

export interface CompletedMirrorJob {
  fileRecordId: string;
  reviewDriveUrl: string;
  driveFileId: string;
  completedAt: string;
}

// Called by the cron route — drains all pending completed mirror jobs from the file server queue.
// Uses a system-level token (admin role) since this is an internal cron call.
export async function drainDriveMirrorQueue(env: CloudflareEnv): Promise<CompletedMirrorJob[]> {
  const token = makeToken('0', 'admin');
  const res = await env.FILE_SERVER.fetch(`${FILE_SERVER_ORIGIN}/drive-mirror/completed`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`File server /drive-mirror/completed failed: ${res.status}`);
  const data = await res.json();
  return data.jobs as CompletedMirrorJob[];
}

// Called after successfully writing Drive URLs to DB — removes jobs from the file server queue.
export async function ackDriveMirrorJobs(env: CloudflareEnv, fileRecordIds: string[]): Promise<void> {
  const token = makeToken('0', 'admin');
  const res = await env.FILE_SERVER.fetch(`${FILE_SERVER_ORIGIN}/drive-mirror/ack`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ fileRecordIds }),
  });
  if (!res.ok) throw new Error(`File server /drive-mirror/ack failed: ${res.status}`);
}

