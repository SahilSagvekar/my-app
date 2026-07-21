// src/lib/youtube-mirror.ts
//
// Uploads a review video to YouTube as Unlisted, so the review screen can
// use YouTube's real IFrame Player API (adaptive bitrate + a real
// postMessage control API, unlike Drive's dumb preview embed). Falls back
// to Drive mirroring (see drive-mirror.ts) when quota is exhausted.

import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getS3, BUCKET } from '@/lib/s3';
import { getYoutubeClient } from '@/lib/youtubeAuth';
import { hasQuotaForUpload, recordQuotaUsage, markQuotaExhausted } from '@/lib/youtube-quota';

export class QuotaExceededError extends Error {
  constructor() {
    super('YouTube API quota exhausted for today');
    this.name = 'QuotaExceededError';
  }
}

function isQuotaError(err: any): boolean {
  const reason = err?.errors?.[0]?.reason || err?.response?.data?.error?.errors?.[0]?.reason;
  return err?.code === 403 && (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded');
}

export async function uploadVideoToYoutube(params: {
  s3Key: string;
  title: string;
  description?: string;
}): Promise<{ videoId: string }> {
  const { s3Key, title, description } = params;

  console.log(`[youtube-mirror] 🎬 Starting upload for "${title}" (${s3Key})`);

  const hasQuota = await hasQuotaForUpload();
  console.log(`[youtube-mirror] 📊 Quota check: ${hasQuota ? 'OK, proceeding' : 'EXHAUSTED, will fall back to Drive'}`);
  if (!hasQuota) {
    throw new QuotaExceededError();
  }

  console.log(`[youtube-mirror] ⬇️  Fetching "${s3Key}" from R2...`);
  const s3 = getS3();
  const data = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: s3Key }));
  if (!data.Body) {
    console.error(`[youtube-mirror] ❌ R2 returned no body for ${s3Key}`);
    throw new Error(`Could not fetch ${s3Key} from R2 for YouTube upload`);
  }
  console.log(`[youtube-mirror] ✅ Got R2 stream, handing off to YouTube API...`);

  const { Readable } = await import('stream');
  const nodeStream = (data.Body as any).pipe ? (data.Body as any) : Readable.fromWeb(data.Body as any);

  const youtube = getYoutubeClient();

  try {
    console.log(`[youtube-mirror] 📤 Uploading to YouTube (Unlisted)...`);
    const res = await youtube.videos.insert({
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          title: title.slice(0, 100),
          description: description || 'Draft review copy — E8 Productions internal review.',
        },
        status: {
          privacyStatus: 'unlisted',
          selfDeclaredMadeForKids: false,
        },
      },
      media: { body: nodeStream },
    });

    await recordQuotaUsage();

    const videoId = res.data.id;
    if (!videoId) {
      console.error(`[youtube-mirror] ❌ YouTube API returned success but no video ID for "${title}"`);
      throw new Error('YouTube upload succeeded but returned no video ID');
    }

    console.log(`[youtube-mirror] ✅ SUCCESS — "${title}" is now on YouTube: https://youtube.com/watch?v=${videoId}`);
    return { videoId };
  } catch (err: any) {
    if (isQuotaError(err)) {
      console.log(`[youtube-mirror] ⚠️  Quota hit mid-upload for "${title}" — marking today's quota exhausted, falling back to Drive`);
      await markQuotaExhausted();
      throw new QuotaExceededError();
    }
    console.error(`[youtube-mirror] ❌ Upload failed for "${title}":`, err.message);
    throw err;
  }
}

export async function deleteYoutubeVideo(videoId: string): Promise<void> {
  console.log(`[youtube-mirror] 🗑️  Deleting YouTube video ${videoId} (task completed)`);
  const youtube = getYoutubeClient();
  try {
    await youtube.videos.delete({ id: videoId });
    console.log(`[youtube-mirror] ✅ Deleted ${videoId} from YouTube`);
  } catch (err: any) {
    if (err?.code === 404) {
      console.log(`[youtube-mirror] ℹ️  ${videoId} already gone from YouTube — nothing to do`);
      return;
    }
    console.error(`[youtube-mirror] ❌ Failed to delete video ${videoId}:`, err.message);
  }
}