import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { getS3, BUCKET } from './s3';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { prisma } from './prisma';

/**
 * Compresses a video file from R2 and uploads the optimized version back.
 */
export async function optimizeVideo(fileId: string): Promise<{ success: boolean; url?: string; error?: string }> {
  const tempDir = os.tmpdir();
  const inputPath = path.join(tempDir, `${fileId}_input`);
  const outputPath = path.join(tempDir, `${fileId}_optimized.mp4`);

  try {
    // 1. Get file metadata from DB
    const file = await prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file || !file.s3Key) {
      console.log('❌ File not found in DB or missing S3 key');
      throw new Error('File not found in database');
    }

    console.log(`🎬 Target file: ${file.name}, Key: ${file.s3Key}`);

    // Set status to PROCESSING
    await prisma.file.update({
      where: { id: fileId },
      data: { 
        optimizationStatus: 'PROCESSING',
        optimizationError: null
      }
    });

    // 2. Download from R2
    console.log('📡 Downloading from R2...');
    const s3 = getS3();
    const { Body } = await s3.send(new GetObjectCommand({
      Bucket: BUCKET,
      Key: file.s3Key,
    }));

    if (!Body) throw new Error('Failed to download from R2');

    // Write body to temp file
    const writeStream = fs.createWriteStream(inputPath);
    await new Promise((resolve, reject) => {
      (Body as any).pipe(writeStream)
        .on('finish', resolve)
        .on('error', reject);
    });
    console.log('✅ Download complete.');

    // 3. Run FFmpeg
    console.log('转码 Starting FFmpeg transcoding...');
    await new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i', inputPath,
        '-vf', "scale='min(1280,iw)':-2", // Scale to 720p max while maintaining aspect ratio
        '-vcodec', 'libx264',
        '-crf', '28', // Lower quality for review (18-28 is good range)
        '-preset', 'faster',
        '-acodec', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart', // Web optimized
        '-y', // Overwrite
        outputPath
      ]);

      ffmpeg.on('close', (code) => {
        if (code === 0) resolve(true);
        else reject(new Error(`FFmpeg exited with code ${code}`));
      });

      ffmpeg.stderr.on('data', (data) => {
        // Log progress or errors if needed
        // console.log(`FFmpeg STDERR: ${data}`);
      });

      ffmpeg.on('error', (err) => {
        console.error('❌ FFmpeg failed to start:', err);
        reject(err);
      });
    });
    console.log('✅ Transcoding complete.');

    // 4. Upload optimized version to R2
    console.log('📤 Uploading optimized version to R2...');
    const optimizedKey = file.s3Key.replace(/(\.[^.]+)$/, '_optimized.mp4');
    const fileStream = fs.createReadStream(outputPath);

    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: optimizedKey,
      Body: fileStream,
      ContentType: 'video/mp4',
    }));

    const optimizedUrl = `${process.env.R2_PUBLIC_URL}/${optimizedKey}`;

    // 5. Update DB
    await prisma.file.update({
      where: { id: fileId },
      data: {
        proxyUrl: optimizedUrl, // We can reuse proxyUrl or use a new field
        optimizationStatus: 'COMPLETED',
        optimizationError: null,
      },
    });

    return { success: true, url: optimizedUrl };

  } catch (err: any) {
    console.error('❌ Optimization failed:', err);
    // Update DB with error status
    await prisma.file.update({
      where: { id: fileId },
      data: {
        optimizationStatus: 'FAILED',
        optimizationError: err.message
      }
    });
    return { success: false, error: err.message };
  } finally {
    // Cleanup
    [inputPath, outputPath].forEach(p => {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    });
  }
}
