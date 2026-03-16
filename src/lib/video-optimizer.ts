import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { getS3, BUCKET } from './s3';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { prisma } from './prisma';

// ---------------------------------------------------------------------------
// Hardware encoder detection — runs once per process, result is cached
// ---------------------------------------------------------------------------

type EncoderInfo = {
  codec: 'h264_nvenc' | 'h264_qsv' | 'h264_videotoolbox' | 'libx264';
  flags: string[];
};

let _encoderCache: EncoderInfo | null = null;

// Set to true to skip GPU encoder detection (useful for local development or unreliable GPU)
const FORCE_CPU_ENCODER = process.env.FORCE_CPU_ENCODER === 'true';

function detectEncoder(): EncoderInfo {
  if (_encoderCache) return _encoderCache;

  // Force CPU encoder if configured
  if (FORCE_CPU_ENCODER) {
    console.log('🎞️  FORCE_CPU_ENCODER is set, using libx264');
    _encoderCache = {
      codec: 'libx264',
      flags: ['-vcodec', 'libx264', '-crf', '26', '-preset', 'fast', '-threads', '0'],
    };
    return _encoderCache;
  }

  try {
    const out = execSync('ffmpeg -encoders 2>&1', { timeout: 5000 }).toString();

    if (out.includes('h264_nvenc')) {
      _encoderCache = {
        codec: 'h264_nvenc',
        flags: ['-vcodec', 'h264_nvenc', '-preset', 'p1', '-rc', 'vbr', '-cq', '28', '-b:v', '0'],
      };
    } else if (out.includes('h264_qsv')) {
      _encoderCache = {
        codec: 'h264_qsv',
        flags: ['-vcodec', 'h264_qsv', '-preset', 'veryfast', '-global_quality', '28', '-look_ahead', '0'],
      };
    } else if (out.includes('h264_videotoolbox')) {
      _encoderCache = {
        codec: 'h264_videotoolbox',
        flags: ['-vcodec', 'h264_videotoolbox', '-q:v', '50'],
      };
    } else {
      _encoderCache = {
        codec: 'libx264',
        flags: ['-vcodec', 'libx264', '-crf', '26', '-preset', 'fast', '-threads', '0'],
      };
    }
  } catch {
    // FFmpeg not found or timed out — fall back to libx264
    _encoderCache = {
      codec: 'libx264',
      flags: ['-vcodec', 'libx264', '-crf', '26', '-preset', 'fast', '-threads', '0'],
    };
  }

  console.log(`🎞️  Encoder selected: ${_encoderCache.codec}`);
  return _encoderCache;
}

// Fall back to libx264 and update cache (called when GPU encoder fails at runtime)
function fallbackToLibx264(): EncoderInfo {
  _encoderCache = {
    codec: 'libx264',
    flags: ['-vcodec', 'libx264', '-crf', '26', '-preset', 'fast', '-threads', '0'],
  };
  console.log('⚠️  GPU encoder failed — falling back to libx264');
  return _encoderCache;
}

// ---------------------------------------------------------------------------
// ffprobe metadata probe (reads container header only via HTTP range)
// ---------------------------------------------------------------------------

async function probeVideoMetadata(signedUrl: string): Promise<{ codec: string; width: number } | null> {
  try {
    const result = await new Promise<string>((resolve, reject) => {
      const proc = spawn('ffprobe', [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_streams',
        '-select_streams', 'v:0',
        signedUrl,
      ]);

      let stdout = '';
      proc.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
      proc.on('close', (code) => {
        if (code === 0) resolve(stdout);
        else reject(new Error(`ffprobe exited with code ${code}`));
      });
      proc.on('error', reject);
    });

    const parsed = JSON.parse(result);
    const stream = parsed?.streams?.[0];
    if (!stream) return null;

    return {
      codec: (stream.codec_name as string) || '',
      width: (stream.width as number) || 0,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Core FFmpeg runner — shared by pipe and file-based paths
// ---------------------------------------------------------------------------

async function runFFmpeg(args: string[]): Promise<{ ok: boolean; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn('ffmpeg', args);
    let stderr = '';

    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
    proc.on('close', (code) => resolve({ ok: code === 0, stderr }));
    proc.on('error', (err) => resolve({ ok: false, stderr: err.message }));
  });
}

// ---------------------------------------------------------------------------
// Main optimizer
// ---------------------------------------------------------------------------

export async function optimizeVideo(fileId: string): Promise<{ success: boolean; url?: string; error?: string }> {
  const tempDir = os.tmpdir();
  
  // Get file info first to determine extension
  const file = await prisma.file.findUnique({ where: { id: fileId } });

  if (!file || !file.s3Key) {
    console.log('❌ File not found in DB or missing S3 key');
    return { success: false, error: 'File not found in database' };
  }

  // Extract extension from original filename for FFmpeg format detection
  const originalExt = path.extname(file.name || file.s3Key || '.mp4') || '.mp4';
  const inputPath = path.join(tempDir, `${fileId}_input${originalExt}`);
  const outputPath = path.join(tempDir, `${fileId}_optimized.mp4`);

  try {
    console.log(`🎬 Target file: ${file.name}, Key: ${file.s3Key}`);
    console.log(`📁 Temp input: ${inputPath}`);

    // Set status to PROCESSING
    await prisma.file.update({
      where: { id: fileId },
      data: { optimizationStatus: 'PROCESSING', optimizationError: null },
    });

    // ------------------------------------------------------------------
    // 2. Smart skip — avoid re-encoding already-good files
    // ------------------------------------------------------------------
    const SKIP_SIZE_LIMIT = 50n * 1024n * 1024n; // 50 MB
    const dbCodec = (file.codec ?? '').toLowerCase();
    const isAlreadyH264 = dbCodec === 'h264' || dbCodec === 'avc1';

    if (isAlreadyH264 && file.size !== null && file.size < SKIP_SIZE_LIMIT) {
      // Get a short-lived signed URL for ffprobe to read the container header
      const s3 = getS3();
      const signedUrl = await getSignedUrl(
        s3,
        new GetObjectCommand({ Bucket: BUCKET, Key: file.s3Key }),
        { expiresIn: 300 }
      );

      const meta = await probeVideoMetadata(signedUrl);
      if (meta && meta.width <= 1280) {
        console.log(`⏭️  Skipping re-encode (already H.264, ${meta.width}px wide, <50 MB)`);
        await prisma.file.update({
          where: { id: fileId },
          data: { proxyUrl: file.url, optimizationStatus: 'COMPLETED', optimizationError: null },
        });
        return { success: true, url: file.url ?? undefined };
      }
    }

    // ------------------------------------------------------------------
    // 3. Download from R2 to temp file, then encode
    //    (pipe-to-stdin is unreliable across platforms and container formats)
    // ------------------------------------------------------------------
    console.log('⬇️  Downloading from R2...');
    const s3 = getS3();
    const { Body, ContentLength } = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: file.s3Key }));
    if (!Body) throw new Error('Failed to download from R2');

    await new Promise<void>((resolve, reject) => {
      const ws = fs.createWriteStream(inputPath);
      (Body as NodeJS.ReadableStream).pipe(ws)
        .on('finish', resolve)
        .on('error', reject);
    });

    // Verify download completed
    const downloadedSize = fs.statSync(inputPath).size;
    console.log(`   Downloaded: ${(downloadedSize / 1024 / 1024).toFixed(2)} MB`);
    
    if (ContentLength && downloadedSize < ContentLength * 0.99) {
      throw new Error(`Incomplete download: got ${downloadedSize} bytes, expected ${ContentLength}`);
    }

    if (downloadedSize < 1000) {
      throw new Error(`Downloaded file too small (${downloadedSize} bytes) - likely corrupted or empty`);
    }

    console.log('⚡ Starting FFmpeg...');
    const encoder = detectEncoder();
    
    // Use simpler scale filter that's more compatible across FFmpeg versions
    // scale=-2:720 means: auto-calculate width to maintain aspect ratio, height=720
    // Or limit width to 1280: scale='min(1280,iw)':'-2' 
    const ffmpegArgs = [
      '-i', inputPath,
      '-vf', 'scale=1280:-2',  // Simplified: scale to 1280px width, auto height
      ...encoder.flags,
      '-acodec', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      '-y',
      outputPath,
    ];

    console.log(`   FFmpeg command: ffmpeg ${ffmpegArgs.join(' ')}`);

    let { ok: transcodeOk, stderr: lastStderr } = await runFFmpeg(ffmpegArgs);

    // --- GPU encoder fallback — detect various failure modes ---
    // Common GPU encoder failures: NVENC not available, driver issues, invalid params
    const gpuFailurePatterns = [
      'No NVENC capable devices',
      'Device creation failed', 
      'Invalid argument',
      'Cannot load',
      'nvenc',
      'NVENC',
      'h264_nvenc',
      'h264_qsv',
      'videotoolbox',
      'Nothing was written into output file',
      'received no packets',
    ];
    
    const isGpuFailure = !transcodeOk && 
      encoder.codec !== 'libx264' && 
      gpuFailurePatterns.some(pattern => lastStderr.includes(pattern));

    if (isGpuFailure) {
      console.log('   ⚠️ GPU encoder failed, falling back to libx264 (CPU)...');
      console.log(`   Error snippet: ${lastStderr.slice(-200)}`);
      
      const fallback = fallbackToLibx264();
      const fallbackArgs = [
        '-i', inputPath,
        '-vf', 'scale=1280:-2',
        ...fallback.flags,
        '-acodec', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
        '-y',
        outputPath,
      ];
      
      console.log(`   Fallback command: ffmpeg ${fallbackArgs.join(' ')}`);
      ({ ok: transcodeOk, stderr: lastStderr } = await runFFmpeg(fallbackArgs));
    }

    if (!transcodeOk) {
      console.error('❌ FFmpeg stderr:', lastStderr);
      throw new Error(`FFmpeg failed: ${lastStderr.slice(-500)}`);
    }

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
      data: { proxyUrl: optimizedUrl, optimizationStatus: 'COMPLETED', optimizationError: null },
    });

    return { success: true, url: optimizedUrl };

  } catch (err: any) {
    console.error('❌ Optimization failed:', err);
    await prisma.file.update({
      where: { id: fileId },
      data: { optimizationStatus: 'FAILED', optimizationError: err.message },
    });
    return { success: false, error: err.message };
  } finally {
    // Cleanup temp files (inputPath only exists in moov-at-end fallback path)
    [inputPath, outputPath].forEach(p => {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    });
  }
}

/**
 * Checks for and restarts stuck optimization jobs (e.g., due to server crash)
 */
export async function checkStuckVideoOptimizationJobs(): Promise<number> {
  console.log('\n🔍 Checking for stuck video optimization jobs...');

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const stuckFiles = await prisma.file.findMany({
    where: {
      optimizationStatus: 'PROCESSING',
      updatedAt: { lt: oneHourAgo },
      mimeType: { startsWith: 'video/' },
    },
    take: 5,
  });

  if (stuckFiles.length === 0) {
    console.log('   No stuck jobs found.');
    return 0;
  }

  console.log(`   Found ${stuckFiles.length} potentially stuck jobs. Restarting...`);

  for (const file of stuckFiles) {
    console.log(`   🚀 Restarting optimization for: ${file.name} (${file.id})`);
    optimizeVideo(file.id);
  }

  return stuckFiles.length;
}