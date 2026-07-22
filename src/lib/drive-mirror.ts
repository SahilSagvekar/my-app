// src/lib/drive-mirror.ts
//
// Dispatches a Drive-mirror job to the file server for a single review
// video — the fallback path used by review-mirror.ts when YouTube upload
// fails or hits its daily quota.
//
// IMPORTANT: this targets the file server's CURRENT contract. POST
// /drive-mirror just accepts the job and streams R2 -> Drive async on the
// file server; it does NOT call back into the main app anymore (see the
// comment in e8-file-server/src/index.js — "callbackUrl is no longer
// used"). Instead the file server pushes completed jobs onto an in-memory
// queue that the main app polls via check-drive-mirrors (registered in
// cron-master.ts as "Drive Mirror Sync", every 30s), which writes
// reviewDriveUrl onto the File record and acks the job. See
// src/app/api/cron/check-drive-mirrors/route.ts.
//
// Fire-and-forget by design: callers don't await the Drive upload itself
// completing — only this dispatch call, which just confirms the file
// server accepted the job.

import { generateFileServerToken } from '@/lib/file-server';

const FILE_SERVER_URL = process.env.FILE_SERVER_URL || 'http://localhost:4000';

function isLikelyGoogleDriveFolderId(value?: string | null): value is string {
  if (!value) return false;
  return /^[a-zA-Z0-9_-]{25,}$/.test(value);
}

export async function triggerDriveMirror(params: {
  key: string;
  fileName: string;
  mimeType: string;
  fileRecordId: string;
  clientName?: string | null;
  driveFolderId?: string | null;
  userId: number;
  userRole?: string | null;
}): Promise<void> {
  const { key, fileName, mimeType, fileRecordId, clientName, driveFolderId, userId, userRole } = params;

  const role = userRole || 'admin';
  const fileServerToken = generateFileServerToken(userId, role);
  const folderId = isLikelyGoogleDriveFolderId(driveFolderId) ? driveFolderId : null;

  try {
    const res = await fetch(`${FILE_SERVER_URL}/drive-mirror`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${fileServerToken}`,
      },
      body: JSON.stringify({
        key,
        fileName,
        mimeType,
        folderId: folderId || undefined,
        clientName: folderId ? undefined : (clientName || 'Unknown Client'),
        fileRecordId,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      console.error(`[drive-mirror] ❌ File server rejected mirror job for ${fileRecordId} ("${fileName}"): ${errText}`);
      return;
    }

    console.log(`[drive-mirror] 📤 Dispatched "${fileName}" (${fileRecordId}) to file server for Drive mirroring — will land via check-drive-mirrors poll`);
  } catch (err: any) {
    console.error(`[drive-mirror] ❌ Failed to reach file server for ${fileRecordId} ("${fileName}"):`, err.message);
  }
}