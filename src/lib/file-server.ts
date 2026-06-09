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
  return fsRequest('POST', '/download-zip', userId, role, opts);
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

export async function initiateMultipart(
  userId: number | string,
  role: string,
  key: string,
  fileType: string
): Promise<{ uploadId: string; key: string }> {
  const token = makeToken(userId, role);
  const res = await fetch(`${FILE_SERVER_URL}/multipart/initiate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ key, fileType }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `File server initiate failed: ${res.status}`);
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
  const res = await fetch(`${FILE_SERVER_URL}/multipart/part-url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ key, uploadId, partNumber }),
  });
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
  const res = await fetch(`${FILE_SERVER_URL}/multipart/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ key, uploadId, parts }),
  });
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