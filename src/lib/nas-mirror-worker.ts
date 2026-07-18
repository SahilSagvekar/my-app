// src/lib/nas-mirror-worker.ts
// Background worker — processes NasMirrorJob rows (copy R2 -> NAS as plain
// files via SFTP, verify, delete verified files from R2, update File
// records). Called by cron-master on an interval, same pattern as
// upload-worker.ts.
//
// Switched from MinIO (S3 API) to SFTP: MinIO stored files in its own
// internal chunked object format, not as directly playable video files —
// SFTP writes genuine files straight into NAS folders instead.
//
// Unlike the upload worker (which pops up to 3 small jobs per tick), a
// mirror job can involve many large video files and take a long time — so
// one tick either starts a new job (if none is running) or does nothing.
// The job runs to completion within that single tick call; cron-master's
// setInterval just won't re-enter while isRunning is true.

import { S3Client, ListObjectsV2Command, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { prisma } from '@/lib/prisma';
import { getS3, BUCKET as R2_BUCKET } from '@/lib/s3';
import { NasSftpSession } from '@/lib/nas-sftp';
import {
  popPendingNasMirrorJob,
  updateNasMirrorJobProgress,
  completeNasMirrorJob,
  failNasMirrorJob,
  recoverStuckNasMirrorJobs,
} from '@/lib/nas-mirror-queue';

let isRunning = false;

export async function runNasMirrorWorkerTick(): Promise<void> {
  if (isRunning) return;
  isRunning = true;

  try {
    await recoverStuckNasMirrorJobs();

    const job = await popPendingNasMirrorJob();
    if (!job) return;

    await processJob(job.id, job.clientName, job.monthFolder);
  } catch (err: any) {
    console.error('[NasMirrorWorker] Tick error:', err.message);
  } finally {
    isRunning = false;
  }
}

async function* listR2Keys(r2: S3Client, prefix: string) {
  let ContinuationToken: string | undefined;
  do {
    const page = await r2.send(new ListObjectsV2Command({ Bucket: R2_BUCKET, Prefix: prefix, ContinuationToken }));
    for (const obj of page.Contents || []) {
      if (obj.Key) yield obj;
    }
    ContinuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (ContinuationToken);
}

async function processJob(jobId: string, clientName: string, monthFolder: string) {
  console.log(`[NasMirrorWorker] Starting job ${jobId}: ${clientName} / ${monthFolder}`);

  const r2 = getS3();
  const prefix = `${clientName}/outputs/${monthFolder}/`;
  const nas = new NasSftpSession();

  try {
    await nas.connect();
  } catch (err: any) {
    await failNasMirrorJob(jobId, `Failed to connect to NAS via SFTP: ${err.message}`);
    return;
  }

  let scanned = 0, copied = 0, verified = 0, deleted = 0, failed = 0;

  try {
    for await (const obj of listR2Keys(r2, prefix)) {
      const key = obj.Key!;
      const size = obj.Size ?? 0;
      scanned++;
      await updateNasMirrorJobProgress(jobId, { scannedCount: scanned, currentFile: key });

      let onNas = await nas.existsWithSize(key, size);
      if (!onNas) {
        try {
          const { Body } = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }));
          await nas.upload(key, Body as any);
          copied++;
          onNas = await nas.existsWithSize(key, size);
        } catch (err: any) {
          console.error(`[NasMirrorWorker] Copy failed for ${key}: ${err.message}`);
          failed++;
          await updateNasMirrorJobProgress(jobId, { copiedCount: copied, failedCount: failed });
          continue;
        }
      }

      if (!onNas) {
        console.error(`[NasMirrorWorker] Verify failed for ${key}`);
        failed++;
        await updateNasMirrorJobProgress(jobId, { copiedCount: copied, failedCount: failed });
        continue;
      }

      verified++;

      // Verified — safe to delete from R2 and mark archived.
      try {
        await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
        await prisma.file.updateMany({
          where: { s3Key: key },
          data: {
            deletedFromCloud: true,
            deletedFromCloudAt: new Date(),
            archivedToNas: true,
            nasArchivedAt: new Date(),
            nasPath: `sftp://${process.env.NAS_SFTP_ROOT_PATH || '/volume2/Backup'}`,
          },
        });
        deleted++;
      } catch (err: any) {
        console.error(`[NasMirrorWorker] Delete failed for ${key}: ${err.message}`);
        failed++;
      }

      await updateNasMirrorJobProgress(jobId, {
        copiedCount: copied,
        verifiedCount: verified,
        deletedCount: deleted,
        failedCount: failed,
      });
    }

    await completeNasMirrorJob(jobId);
    console.log(`[NasMirrorWorker] Job ${jobId} done — scanned ${scanned}, copied ${copied}, verified ${verified}, deleted ${deleted}, failed ${failed}`);
  } catch (err: any) {
    console.error(`[NasMirrorWorker] Job ${jobId} crashed:`, err.message);
    await failNasMirrorJob(jobId, err.message);
  } finally {
    await nas.disconnect();
  }
}