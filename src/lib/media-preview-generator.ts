import { spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { generateSignedUrl, uploadBufferToS3, BUCKET } from '@/lib/s3';
import { getDbHttp } from '@/lib/db';
import { mediaPreview, file as fileTable, task as taskTable } from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { eq, and, inArray } from 'drizzle-orm';
import sharp from 'sharp';

export interface PreviewGenerationResult {
  taskId: string;
  taskTitle?: string | null;
  s3Key: string;
  previewS3Key: string;
  width: number;
  height: number;
  durationSeconds: number;
  status: 'READY' | 'FAILED' | 'SKIPPED';
  error?: string;
}

/**
 * Gets video metadata (duration, width, height) using ffprobe.
 */
function probeVideo(inputUrl: string): Promise<{ duration: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height,duration:format=duration',
      '-of', 'json',
      inputUrl,
    ]);

    let stdout = '';
    let stderr = '';

    ffprobe.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    ffprobe.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffprobe.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`ffprobe failed with code ${code}: ${stderr}`));
      }
      try {
        const info = JSON.parse(stdout);
        const stream = info.streams?.[0] || {};
        const format = info.format || {};
        const duration = parseFloat(stream.duration || format.duration || '0');
        const width = stream.width || 1280;
        const height = stream.height || 720;
        resolve({ duration, width, height });
      } catch (err) {
        reject(new Error(`Failed to parse ffprobe output: ${err}`));
      }
    });

    ffprobe.on('error', (err) => reject(err));
  });
}

/**
 * Extracts a single frame at a specific timestamp using ffmpeg to a temporary image.
 */
function extractFrame(inputUrl: string, timestampSeconds: number, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-y',
      '-ss', timestampSeconds.toFixed(2),
      '-i', inputUrl,
      '-vframes', '1',
      '-q:v', '2',
      outputPath,
    ]);

    let stderr = '';
    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`ffmpeg frame extraction failed with code ${code}: ${stderr}`));
      }
      resolve();
    });

    ffmpeg.on('error', (err) => reject(err));
  });
}

/**
 * Generates and saves a preview thumbnail for a given video S3 key.
 */
export async function generateThumbnailForVideoKey(
  s3Key: string,
  taskId?: string | null,
  fileId?: string | null
): Promise<PreviewGenerationResult> {
  const db = getDbHttp();
  const tempDir = os.tmpdir();
  const tempOutput = path.join(tempDir, `preview-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`);

  try {
    // 1. Generate signed URL for streaming from S3/R2 directly to ffmpeg
    const signedUrl = await generateSignedUrl(s3Key, 3600);

    // 2. Probe video metadata
    let duration = 0;
    let originalWidth = 1280;
    let originalHeight = 720;
    try {
      const meta = await probeVideo(signedUrl);
      duration = meta.duration;
      originalWidth = meta.width;
      originalHeight = meta.height;
    } catch (probeErr) {
      console.warn(`[preview-gen] ffprobe warning for ${s3Key}:`, probeErr);
    }

    // 3. Choose a good timestamp (10-15% into the video, or 3-5 seconds, min 1s)
    let seekTime = 3.0;
    if (duration > 0) {
      seekTime = Math.min(Math.max(duration * 0.12, 1.0), Math.max(duration - 1.0, 0.5));
    }

    // 4. Extract frame with ffmpeg
    await extractFrame(signedUrl, seekTime, tempOutput);

    // 5. Read frame and convert/resize with sharp to WebP (max 1280px width)
    const rawImageBuffer = await fs.promises.readFile(tempOutput);
    const optimizedWebpBuffer = await sharp(rawImageBuffer)
      .resize({ width: 1280, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();

    const imageMetadata = await sharp(optimizedWebpBuffer).metadata();
    const finalWidth = imageMetadata.width || originalWidth;
    const finalHeight = imageMetadata.height || originalHeight;

    // 6. Compute stable hash for S3 key
    const hash = crypto.createHash('sha256').update(s3Key).digest('hex').slice(0, 32);
    const previewS3Key = `__media-previews/${hash}.webp`;

    // 7. Upload WebP thumbnail to S3/R2
    await uploadBufferToS3({
      buffer: optimizedWebpBuffer,
      folderPrefix: '__media-previews/',
      filename: `${hash}.webp`,
      mimeType: 'image/webp',
    });

    // 8. Update DB MediaPreview table
    const now = new Date().toISOString();
    await db.insert(mediaPreview).values({
      id: createId(),
      s3Key,
      fileId: fileId || null,
      taskId: taskId || null,
      previewS3Key,
      status: 'READY',
      width: finalWidth,
      height: finalHeight,
      durationSeconds: duration,
      frameTimestampSeconds: seekTime,
      attempts: 1,
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: mediaPreview.s3Key,
      set: {
        fileId: fileId || null,
        taskId: taskId || null,
        previewS3Key,
        status: 'READY',
        width: finalWidth,
        height: finalHeight,
        durationSeconds: duration,
        frameTimestampSeconds: seekTime,
        errorMessage: null,
        updatedAt: now,
      },
    });

    return {
      taskId: taskId || '',
      s3Key,
      previewS3Key,
      width: finalWidth,
      height: finalHeight,
      durationSeconds: duration,
      status: 'READY',
    };
  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    const now = new Date().toISOString();

    await db.insert(mediaPreview).values({
      id: createId(),
      s3Key,
      fileId: fileId || null,
      taskId: taskId || null,
      status: 'FAILED',
      errorMessage: errorMsg,
      attempts: 1,
      createdAt: now,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: mediaPreview.s3Key,
      set: {
        fileId: fileId || null,
        taskId: taskId || null,
        status: 'FAILED',
        errorMessage: errorMsg,
        updatedAt: now,
      },
    });

    return {
      taskId: taskId || '',
      s3Key,
      previewS3Key: '',
      width: 0,
      height: 0,
      durationSeconds: 0,
      status: 'FAILED',
      error: errorMsg,
    };
  } finally {
    if (fs.existsSync(tempOutput)) {
      try {
        await fs.promises.unlink(tempOutput);
      } catch {}
    }
  }
}
