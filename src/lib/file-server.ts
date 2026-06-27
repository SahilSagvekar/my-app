// src/lib/file-server.ts
// Proxy client — main app calls this instead of hitting S3/Drive directly.
// All heavy file operations are forwarded to the dedicated file server.

import jwt from 'jsonwebtoken';

const FILE_SERVER_URL = process.env.FILE_SERVER_URL || 'http://127.0.0.1:4000';
const FILE_SERVER_SECRET = process.env.FILE_SERVER_SECRET || '';

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
  method: string,
  path: string,
  userId: number | string,
  role: string,
  body?: object,
  queryParams?: Record<string, string>,
  timeoutMs: number = 20_000,
): Promise<Response> {
  const token = makeToken(userId, role);
  const url = new URL(`${FILE_SERVER_URL}${path}`);

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
    signal: AbortSignal.timeout(timeoutMs),
  };

  if (body && method !== 'GET') {
    (options as any).body = JSON.stringify(body);
  }

  return fetch(url.toString(), options);
}

export async function getStructure(userId: number | string, role: string, prefix: string) {
  const res = await fsRequest('GET', '/structure', userId, role, undefined, { prefix, role });
  if (!res.ok) throw new Error(`File server error: ${res.status}`);
  return res.json();
}

export async function searchFiles(userId: number | string, role: string, query: string, prefix: string, max = 50) {
  const res = await fsRequest('GET', '/search', userId, role, undefined, { q: query, prefix, max: String(max), role });
  if (!res.ok) throw new Error(`File server error: ${res.status}`);
  return res.json();
}

export async function presignUpload(userId: number | string, role: string, key: string, contentType: string) {
  const res = await fsRequest('POST', '/presign-upload', userId, role, { key, contentType });
  if (!res.ok) throw new Error(`File server error: ${res.status}`);
  return res.json() as Promise<{ uploadUrl: string; fileUrl: string; key: string }>;
}

export async function presignDownload(userId: number | string, role: string, s3Key: string, fileName?: string) {
  const res = await fsRequest('POST', '/presign-download', userId, role, { s3Key, fileName });
  if (!res.ok) throw new Error(`File server error: ${res.status}`);
  return res.json() as Promise<{ downloadUrl: string }>;
}

export async function streamZip(
  userId: number | string,
  role: string,
  opts: { keys?: string[]; folderPrefix?: string; zipName?: string },
): Promise<Response> {
  // Zip streams can run for many minutes on large folders — DO NOT use
  // AbortSignal here. AbortSignal.timeout() aborts the entire fetch lifecycle
  // including body piping, which kills the stream mid-transfer and causes
  // Next.js to throw "failed to pipe response". Raw fetch with no signal
  // lets the file server stream at its own pace until the archive finalizes.
  const token = makeToken(userId, role);
  return fetch(`${FILE_SERVER_URL}/download-zip`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(opts),
    // No signal — zip duration is unbounded
  });
}

export async function deleteItem(userId: number | string, role: string, s3Key: string, type: 'file' | 'folder') {
  const res = await fsRequest('DELETE', '/delete', userId, role, { s3Key, type });
  if (!res.ok) throw new Error(`File server error: ${res.status}`);
  return res.json();
}

export async function moveItem(
  userId: number | string,
  role: string,
  sourceKey: string,
  destinationFolderKey: string,
  type: 'file' | 'folder',
) {
  const res = await fsRequest('POST', '/move', userId, role, { sourceKey, destinationFolderKey, type });
  if (!res.ok) throw new Error(`File server error: ${res.status}`);
  return res.json();
}

export async function createFolder(userId: number | string, role: string, folderPath: string, folderName: string) {
  const res = await fsRequest('POST', '/folder', userId, role, { folderPath, folderName });
  if (!res.ok) throw new Error(`File server error: ${res.status}`);
  return res.json();
}

export async function renameFolder(userId: number | string, role: string, oldPath: string, newName: string) {
  const res = await fsRequest('PATCH', '/folder', userId, role, { oldPath, newName });
  if (!res.ok) throw new Error(`File server error: ${res.status}`);
  return res.json();
}

export async function getDriveSignedUrl(userId: number | string, role: string, fileId: string): Promise<{ url: string; expiresIn: number }> {
  const res = await fsRequest('GET', '/drive-signed-url', userId, role, undefined, { fileId });
  if (!res.ok) throw new Error(`File server error: ${res.status}`);
  return res.json();
}

export async function getDriveProxyStream(userId: number | string, role: string, fileId: string, range?: string): Promise<Response> {
  const token = makeToken(userId, role);
  const url = `${FILE_SERVER_URL}/drive-proxy?fileId=${fileId}`;
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (range) headers['Range'] = range;
  return fetch(url, { headers });
}

export async function invalidateCache(userId: number | string, role: string, prefix?: string) {
  const res = await fsRequest('POST', '/cache/invalidate', userId, role, { prefix });
  return res.ok;
}

// ─── Multipart Upload Proxies ─────────────────────────────────────────────────

// ─── Fetch with timeout + retry ──────────────────────────────────────────────
// Wraps fetch with an AbortSignal timeout and optional retry with backoff.
// Prevents file server calls from hanging forever when the server is busy.
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  timeoutMs = 20_000,
  maxAttempts = 3,
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(timeoutMs),
      });
      return res;
    } catch (err: any) {
      lastError = err;
      const isTimeout = err.name === 'TimeoutError' || err.name === 'AbortError';
      const backoffMs = Math.pow(2, attempt) * 1000;
      console.warn(
        `[file-server] ${isTimeout ? 'Timeout' : 'Error'} on ${url} attempt ${attempt + 1}/${maxAttempts}. ${attempt < maxAttempts - 1 ? `Retrying in ${backoffMs}ms...` : 'Giving up.'}`,
      );
      if (attempt < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }
  }

  throw lastError || new Error(`File server unreachable after ${maxAttempts} attempts: ${url}`);
}

export async function initiateMultipart(
  userId: number | string,
  role: string,
  key: string,
  fileType: string,
  fileSize?: number,
): Promise<{ uploadId: string; key: string }> {
  const token = makeToken(userId, role);
  const res = await fetchWithRetry(`${FILE_SERVER_URL}/multipart/initiate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ key, fileType, fileSize }),
  }, 15_000, 3);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const error: any = new Error(err.error || `File server initiate failed: ${res.status}`);
    error.Code = err.code; // preserve USE_SINGLE_PUT code
    throw error;
  }
  return res.json();
}

export async function getPartUrl(
  userId: number | string,
  role: string,
  key: string,
  uploadId: string,
  partNumber: number
): Promise<{ presignedUrl: string }> {
  const token = makeToken(userId, role);
  const res = await fetchWithRetry(`${FILE_SERVER_URL}/multipart/part-url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ key, uploadId, partNumber }),
  }, 15_000, 3);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `File server part-url failed: ${res.status}`);
  }
  return res.json();
}

export async function completeMultipart(
  userId: number | string,
  role: string,
  key: string,
  uploadId: string,
  parts: Array<{ ETag: string; PartNumber: number }>
): Promise<{ success: boolean; etag?: string; location?: string }> {
  const token = makeToken(userId, role);
  // completeMultipart is the most critical step — longer timeout, more retries
  const res = await fetchWithRetry(`${FILE_SERVER_URL}/multipart/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ key, uploadId, parts }),
  }, 60_000, 5); // 60s timeout, 5 attempts — losing this step after full upload is worst case
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
  userId: number | string,
  role: string,
  key: string,
  uploadId: string
): Promise<void> {
  const token = makeToken(userId, role);
  const res = await fetch(`${FILE_SERVER_URL}/multipart/abort`, {
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
export async function drainDriveMirrorQueue(): Promise<CompletedMirrorJob[]> {
  const token = makeToken('0', 'admin');
  const res = await fetch(`${FILE_SERVER_URL}/drive-mirror/completed`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`File server /drive-mirror/completed failed: ${res.status}`);
  const data = await res.json();
  return data.jobs as CompletedMirrorJob[];
}

// Called after successfully writing Drive URLs to DB — removes jobs from the file server queue.
export async function ackDriveMirrorJobs(fileRecordIds: string[]): Promise<void> {
  const token = makeToken('0', 'admin');
  const res = await fetch(`${FILE_SERVER_URL}/drive-mirror/ack`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ fileRecordIds }),
  });
  if (!res.ok) throw new Error(`File server /drive-mirror/ack failed: ${res.status}`);
}