// src/lib/review-mirror.ts
import { getDbHttp } from '@/lib/db';
import { file as fileTable } from '@/lib/db/schema';
import { and, eq, isNull, like } from 'drizzle-orm';
import { uploadVideoToYoutube, QuotaExceededError } from '@/lib/youtube-mirror';
import { triggerDriveMirror } from '@/lib/drive-mirror';
// import { triggerDriveMirror } from '@/lib/drive-mirror';

export async function triggerReviewMirror(params: {
  taskId: string;
  taskTitle: string;
  clientName?: string | null;
  driveFolderId?: string | null;
  userId: number;
  userRole?: string | null;
}): Promise<void> {
  const db = getDbHttp();
  const { taskId, taskTitle, clientName, driveFolderId, userId, userRole } = params;

  console.log(`[review-mirror] 🚦 Task "${taskTitle}" (${taskId}) entered CLIENT_REVIEW — checking for videos to mirror`);

  const files = await db
    .select({ id: fileTable.id, s3Key: fileTable.s3Key, name: fileTable.name, mimeType: fileTable.mimeType })
    .from(fileTable)
    .where(
      and(
        eq(fileTable.taskId, taskId),
        eq(fileTable.isActive, true),
        like(fileTable.mimeType, 'video/%'),
        isNull(fileTable.youtubeVideoId),
        isNull(fileTable.reviewDriveUrl),
      )
    );

  console.log(`[review-mirror] 📁 Found ${files.length} unmirrored video file(s) on this task`);

  for (const file of files) {
    if (!file.s3Key) {
      console.log(`[review-mirror] ⏭️  Skipping "${file.name}" — no s3Key`);
      continue;
    }

    try {
      const { videoId } = await uploadVideoToYoutube({
        s3Key: file.s3Key,
        title: `${taskTitle} — ${file.name}`.slice(0, 100),
      });

      await db.update(fileTable).set({
        youtubeVideoId: videoId,
        youtubeUploadedAt: new Date().toISOString(),
      }).where(eq(fileTable.id, file.id));

      console.log(`[review-mirror] ✅ File ${file.id} ("${file.name}") mirrored to YouTube: ${videoId}`);
    } catch (err: any) {
      if (err instanceof QuotaExceededError) {
        console.log(`[review-mirror] 🔀 YouTube unavailable for file ${file.id} ("${file.name}") — routing to Drive instead`);
      } else {
        console.error(`[review-mirror] 🔀 YouTube upload errored for file ${file.id} ("${file.name}"), routing to Drive:`, err.message);
      }

      triggerDriveMirror({
        key: file.s3Key,
        fileName: file.name || 'review-video',
        mimeType: file.mimeType || 'video/mp4',
        fileRecordId: file.id,
        clientName,
        driveFolderId,
        userId,
        userRole,
      });
    }
  }

  console.log(`[review-mirror] 🏁 Done processing task "${taskTitle}" (${taskId})`);
}
