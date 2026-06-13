// src/lib/upload-worker.ts
// Processes upload completion jobs in the background.
// Called by cron-master every 3 seconds — handles DB writes, storage update,
// Drive mirror, Slack notification, and audit log after R2 assembly is done.

import { prisma } from '@/lib/prisma';
import { getFileUrl } from '@/lib/s3';
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
  // Prevent concurrent ticks
  if (isRunning) return;
  isRunning = true;

  try {
    // Recover any stuck jobs on startup (safe to call repeatedly)
    await recoverStuckJobs();

    // Process up to 3 jobs per tick to avoid blocking cron-master too long
    for (let i = 0; i < 3; i++) {
      const job = await popUploadJob();
      if (!job) break; // queue empty
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
      taskId, subfolder, codec, userId, userRole,
      driveFolderId, clientName, requiresClientReview,
      clientId, isDriveUpload,
    } = job;

    // ── Drive-only upload (no task DB record needed) ───────────────────────
    if (isDriveUpload) {
      sendUploadNotification({
        fileName,
        fileSize: fileSize || 0,
        uploadedBy: userId,
        clientId: clientId || undefined,
        folderType: 'drive',
        s3Key: key,
      }).catch((err: any) => console.error('[UploadWorker] Drive Slack failed:', err.message));

      await ackUploadJob(job.id);
      console.log(`[UploadWorker] ✅ Drive upload job ${job.id} done`);
      return;
    }

    // ── Track storage for raw-footage ──────────────────────────────────────
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
        console.log(`[UploadWorker] Storage updated: ${storageResult.storageInfo.usedFormatted} / ${storageResult.storageInfo.limitFormatted}`);
      }
    }

    // ── Determine folderType ───────────────────────────────────────────────
    const folderType = !subfolder || subfolder === 'main' ? 'main' : subfolder;

    // ── Parallel DB reads ──────────────────────────────────────────────────
    const [existingActiveFile, taskForDrive] = await Promise.all([
      prisma.file.findFirst({
        where: { taskId, folderType, isActive: true },
        orderBy: { version: 'desc' },
      }),
      prisma.task.findUnique({
        where: { id: taskId },
        select: {
          requiresClientReview: true,
          driveFolderId: true,
          clientId: true,
          client: { select: { companyName: true, name: true } },
        },
      }),
    ]);

    const newVersion = existingActiveFile ? existingActiveFile.version + 1 : 1;

    // ── Create file record ─────────────────────────────────────────────────
    const fileRecord = await prisma.file.create({
      data: {
        name: fileName,
        url: fileUrl,
        s3Key: key,
        mimeType: fileType,
        size: fileSize,
        taskId,
        uploadedBy: userId,
        folderType,
        version: newVersion,
        isActive: true,
        codec,
        proxyUrl: null,
      },
    });

    // Set proxyUrl now that we have the real ID
    if (fileType.startsWith('video/')) {
      await prisma.file.update({
        where: { id: fileRecord.id },
        data: { proxyUrl: `/api/files/${fileRecord.id}/stream` },
      });
    }

    console.log(`[UploadWorker] File v${newVersion} saved: ${fileRecord.id}`);

    // ── Drive mirror ───────────────────────────────────────────────────────
    if (fileType.startsWith('video/')) {
      const needsDriveMirror =
        requiresClientReview === true ||
        taskForDrive?.requiresClientReview === true;

      if (needsDriveMirror) {
        const _key = fileRecord.s3Key || key;
        const _driveFolderId = isLikelyGoogleDriveFolderId(taskForDrive?.driveFolderId)
          ? taskForDrive!.driveFolderId
          : isLikelyGoogleDriveFolderId(driveFolderId)
          ? driveFolderId
          : null;
        const _clientName =
          taskForDrive?.client?.companyName ||
          taskForDrive?.client?.name ||
          clientName ||
          'Unknown Client';

        const FILE_SERVER_URL = process.env.FILE_SERVER_URL || 'http://localhost:4000';
        const APP_URL =
          process.env.INTERNAL_APP_URL ||
          process.env.NEXTAUTH_URL ||
          process.env.BASE_URL ||
          'https://e8productions.com';

        const token = generateFileServerToken(userId, userRole || 'editor');
        const callbackToken = jwt.sign(
          { purpose: 'drive-mirror-complete', fileRecordId: fileRecord.id },
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
            key: _key,
            fileName,
            mimeType: fileType,
            folderId: _driveFolderId || undefined,
            clientName: _driveFolderId ? undefined : _clientName,
            fileRecordId: fileRecord.id,
            callbackUrl: callbackUrl.toString(),
          }),
          signal: AbortSignal.timeout(15_000),
        }).then(r => {
          if (!r.ok) r.text().then(t => console.error(`[UploadWorker] Drive mirror dispatch failed: ${t}`));
          else console.log(`[UploadWorker] Drive mirror dispatched for "${fileName}"`);
        }).catch((err: any) => {
          console.error(`[UploadWorker] Drive mirror dispatch error: ${err.message}`);
        });
      }
    }

    // ── Mark old file inactive + push driveLink ────────────────────────────
    await Promise.all([
      existingActiveFile
        ? prisma.file.update({
            where: { id: existingActiveFile.id },
            data: { isActive: false, replacedAt: new Date(), replacedBy: fileRecord.id },
          })
        : Promise.resolve(null),
      prisma.task.update({
        where: { id: taskId },
        data: { driveLinks: { push: fileUrl } },
      }),
    ]);

    // ── Audit log + Slack — fire-and-forget ───────────────────────────────
    createAuditLog({
      userId,
      action: AuditAction.FILE_UPLOADED,
      entity: 'File',
      entityId: fileRecord.id,
      details: `Uploaded file: ${fileName} (v${newVersion}) to folder: ${folderType}`,
      metadata: { taskId, fileName, fileSize, version: newVersion, folderType },
    }).catch((err: any) => console.error('[UploadWorker] AuditLog failed:', err.message));

    sendUploadNotification({
      fileName,
      fileSize: fileSize || 0,
      uploadedBy: userId,
      clientId: taskForDrive?.clientId || clientId || undefined,
      taskId,
      folderType,
      s3Key: key,
    }).catch((err: any) => console.error('[UploadWorker] Slack failed:', err.message));

    await ackUploadJob(job.id);
    console.log(`[UploadWorker] ✅ Job ${job.id} completed — file v${newVersion}`);

  } catch (err: any) {
    console.error(`[UploadWorker] ❌ Job ${job.id} failed:`, err.message);
    await failUploadJob(job, err.message);
  }
}