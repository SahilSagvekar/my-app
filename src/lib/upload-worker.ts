// src/lib/upload-worker.ts
// Background worker — handles everything AFTER the file record is in the DB.
// Called by cron-master every 3 seconds.
//
// Handles:
//   - Storage usage update (raw footage)
//   - Google Drive mirror dispatch
//   - Slack upload notification
//   - Audit log
//
// Does NOT handle (done synchronously in upload/complete):
//   - R2 assembly
//   - File record creation
//   - Mark old version inactive
//   - driveLinks push

import { prisma } from '@/lib/prisma';
import { generateFileServerToken } from '@/lib/file-server';
import { updateClientStorageAfterUpload } from '@/lib/storage-service';
import { sendUploadNotification } from '@/lib/upload-notifications';
import { createAuditLog, AuditAction } from '@/lib/audit-logger';
import { popUploadJob, ackUploadJob, failUploadJob, recoverStuckJobs, UploadJob } from '@/lib/upload-queue';
import jwt from 'jsonwebtoken';

function isLikelyGoogleDriveFolderId(value?: string | null): value is string {
  return !!value && !value.includes('/') && !value.includes('\\');
}

let isRunning = false;

export async function runUploadWorkerTick(): Promise<void> {
  if (isRunning) return;
  isRunning = true;

  try {
    await recoverStuckJobs();

    // Process up to 3 jobs per tick
    for (let i = 0; i < 3; i++) {
      const job = await popUploadJob();
      if (!job) break;
      await processJob(job);
    }
  } catch (err: any) {
    console.error('[UploadWorker] Tick error:', err.message);
  } finally {
    isRunning = false;
  }
}

async function processJob(job: UploadJob): Promise<void> {
  console.log(`[UploadWorker] Processing job ${job.id} — ${job.fileName} (attempt ${job.attempts})`);

  try {
    const {
      key, fileUrl, fileName, fileSize, fileType,
      taskId, subfolder, userId, userRole,
      driveFolderId, clientName, requiresClientReview,
      clientId, isDriveUpload, fileRecordId, taggedEditorIds,
    } = job;

    // ── Drive-only upload — just send Slack ──────────────────────────────
    if (isDriveUpload) {
      sendUploadNotification({
        fileName,
        fileSize: fileSize || 0,
        uploadedBy: userId,
        clientId: clientId || undefined,
        folderType: 'drive',
        s3Key: key,
        taggedEditorIds: taggedEditorIds || undefined,
      }).catch((err: any) => console.error('[UploadWorker] Drive Slack failed:', err.message));

      await ackUploadJob(job.id);
      console.log(`[UploadWorker] ✅ Drive upload job ${job.id} done`);
      return;
    }

    // ── Storage update for raw footage ───────────────────────────────────
    const isRawFootageUpload = key.includes('raw-footage');
    if (isRawFootageUpload && fileSize) {
      const pathParts = key.split('/');
      const companyName = pathParts[0];
      const client = await prisma.client.findFirst({
        where: { OR: [{ companyName }, { name: companyName }] },
        select: { id: true },
      });
      if (client) {
        const storageResult = await updateClientStorageAfterUpload(client.id, fileSize);
        console.log(`[UploadWorker] Storage: ${storageResult.storageInfo.usedFormatted} / ${storageResult.storageInfo.limitFormatted}`);
      }
    }

    // ── Drive mirror — only for video files that need client review ───────
    if (fileType.startsWith('video/') && fileRecordId) {
      const needsDriveMirror = requiresClientReview === true;

      if (needsDriveMirror) {
        const _driveFolderId = isLikelyGoogleDriveFolderId(driveFolderId) ? driveFolderId : null;
        const _clientName = clientName || 'Unknown Client';
        const FILE_SERVER_URL = process.env.FILE_SERVER_URL || 'http://localhost:4000';
        const APP_URL =
          process.env.INTERNAL_APP_URL ||
          process.env.NEXTAUTH_URL ||
          process.env.BASE_URL ||
          'https://e8productions.com';

        const token = generateFileServerToken(userId, userRole || 'editor');
        const callbackToken = jwt.sign(
          { purpose: 'drive-mirror-complete', fileRecordId },
          process.env.FILE_SERVER_SECRET || '',
          { expiresIn: '24h' },
        );
        const callbackUrl = new URL('/api/internal/drive-mirror-complete', APP_URL);
        callbackUrl.searchParams.set('token', callbackToken);

        fetch(`${FILE_SERVER_URL}/drive-mirror`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            key,
            fileName,
            mimeType: fileType,
            folderId: _driveFolderId || undefined,
            clientName: _driveFolderId ? undefined : _clientName,
            fileRecordId,
            callbackUrl: callbackUrl.toString(),
          }),
          signal: AbortSignal.timeout(15_000),
        }).then(r => {
          if (!r.ok) r.text().then(t => console.error(`[UploadWorker] Drive mirror failed: ${t}`));
          else console.log(`[UploadWorker] Drive mirror dispatched for "${fileName}"`);
        }).catch((err: any) => {
          console.error(`[UploadWorker] Drive mirror error: ${err.message}`);
        });
      }
    }

    // ── Audit log ────────────────────────────────────────────────────────
    const folderType = !subfolder || subfolder === 'main' ? 'main' : subfolder;
    createAuditLog({
      userId,
      action: AuditAction.FILE_UPLOADED,
      entity: 'File',
      entityId: fileRecordId || key,
      details: `Uploaded file: ${fileName} to folder: ${folderType}`,
      metadata: { taskId, fileName, fileSize, folderType },
    }).catch((err: any) => console.error('[UploadWorker] AuditLog failed:', err.message));

    // ── Slack notification ───────────────────────────────────────────────
    sendUploadNotification({
      fileName,
      fileSize: fileSize || 0,
      uploadedBy: userId,
      clientId: clientId || undefined,
      taskId,
      folderType,
      s3Key: key,
      taggedEditorIds: taggedEditorIds || undefined,
    }).catch((err: any) => console.error('[UploadWorker] Slack failed:', err.message));

    await ackUploadJob(job.id);
    console.log(`[UploadWorker] ✅ Job ${job.id} done`);

  } catch (err: any) {
    console.error(`[UploadWorker] ❌ Job ${job.id} failed:`, err.message);
    await failUploadJob(job, err.message);
  }
}