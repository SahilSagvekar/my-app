// src/lib/nas-mirror-worker.ts
// Background worker — processes NasMirrorJob rows (copy R2 -> NAS MinIO,
// verify, delete verified files from R2, update File records).
// Called by cron-master on an interval, same pattern as upload-worker.ts.
//
// Unlike the upload worker (which pops up to 3 small jobs per tick), a
// mirror job can involve many large video files and take a long time — so
// one tick either starts a new job (if none is running) or does nothing.
// The job runs to completion within that single tick call; cron-master's
// setInterval just won't re-enter while isRunning is true.

import { S3Client, ListObjectsV2Command, HeadObjectCommand, GetObjectCommand, PutObjectCommand, DeleteObjectCommand, CreateBucketCommand } from '@aws-sdk/client-s3';
import { prisma } from '@/lib/prisma';
import { getS3, BUCKET as R2_BUCKET } from '@/lib/s3';
import { getNasS3, NAS_BUCKET } from '@/lib/nas-s3';
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

async function headOnNas(nas: S3Client, key: string): Promise<{ ok: boolean; size?: number }> {
  try {
    const head = await nas.send(new HeadObjectCommand({ Bucket: NAS_BUCKET, Key: key }));
    return { ok: true, size: head.ContentLength };
  } catch {
    return { ok: false };
  }
}

async function copyToNas(r2: S3Client, nas: S3Client, key: string, expectedSize: number) {
  const { Body, ContentType } = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }));
  await nas.send(new PutObjectCommand({
    Bucket: NAS_BUCKET,
    Key: key,
    Body: Body as any,
    ContentLength: expectedSize,
    ContentType,
  }));
}

async function processJob(jobId: string, clientName: string, monthFolder: string) {
  console.log(`[NasMirrorWorker] Starting job ${jobId}: ${clientName} / ${monthFolder}`);

  const r2 = getS3();
  const nas = getNasS3();
  const prefix = `${clientName}/outputs/${monthFolder}/`;

  try {
    await nas.send(new CreateBucketCommand({ Bucket: NAS_BUCKET }));
  } catch (err: any) {
    if (err.name !== 'BucketAlreadyOwnedByYou' && err.name !== 'BucketAlreadyExists') {
      await failNasMirrorJob(jobId, `Failed to ensure NAS bucket: ${err.message}`);
      return;
    }
  }

  let scanned = 0, copied = 0, verified = 0, deleted = 0, failed = 0;

  try {
    for await (const obj of listR2Keys(r2, prefix)) {
      const key = obj.Key!;
      const size = obj.Size ?? 0;
      scanned++;
      await updateNasMirrorJobProgress(jobId, { scannedCount: scanned, currentFile: key });

      let head = await headOnNas(nas, key);
      if (!(head.ok && head.size === size)) {
        try {
          await copyToNas(r2, nas, key, size);
          copied++;
          head = await headOnNas(nas, key);
        } catch (err: any) {
          console.error(`[NasMirrorWorker] Copy failed for ${key}: ${err.message}`);
          failed++;
          await updateNasMirrorJobProgress(jobId, { copiedCount: copied, failedCount: failed });
          continue;
        }
      }

      if (!(head.ok && head.size === size)) {
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
            nasPath: `minio://${NAS_BUCKET}`,
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
  }
}