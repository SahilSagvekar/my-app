// src/thumbnail.js — video thumbnail extraction for Raw Footage
//
// Design constraints this respects (from the Raw Footage size discussion):
//  - Never downloads a full clip. Only the first RANGE_BYTES of the file is
//    pulled, regardless of whether the clip is 2 GB or 200 GB.
//  - If that partial range isn't enough for ffmpeg to find a frame (some
//    camera-native containers keep their index at the END of the file),
//    we do NOT fall back to downloading the whole thing automatically —
//    we fail the job and flag it. A human can decide whether a full
//    download is worth it for that specific file.
//  - Runs entirely off a temp file on local disk, always cleaned up.

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

const { GetObjectCommand } = require('@aws-sdk/client-s3');
const { BUCKET, getS3, putObject } = require('./s3');

const RAW_FOOTAGE_SEGMENT = 'raw-footage';
const THUMBNAIL_PREFIX = '.thumbnails/';
const RANGE_BYTES = 80 * 1024 * 1024; // first 80 MB — enough for most fast-start MP4/MOV
const SEEK_SECONDS = 2; // grab a frame a couple seconds in, not a black opening frame
const FFMPEG_TIMEOUT_MS = 60 * 1000;

const VIDEO_EXTENSIONS = new Set([
  'mp4', 'mov', 'm4v', 'avi', 'mkv', 'webm', 'mxf', 'mts', 'm2ts',
]);

function isVideoKey(key) {
  const ext = key.split('.').pop()?.toLowerCase();
  return VIDEO_EXTENSIONS.has(ext || '');
}

function isRawFootageKey(key) {
  const parts = key.split('/').filter(Boolean);
  const ancestors = parts.slice(0, -1); // exclude the filename itself
  return ancestors.includes(RAW_FOOTAGE_SEGMENT);
}

function shouldThumbnail(key) {
  return isVideoKey(key) && isRawFootageKey(key);
}

function thumbnailKeyFor(sourceKey) {
  return `${THUMBNAIL_PREFIX}${sourceKey}.jpg`;
}

/** Download just the first RANGE_BYTES of an object to a local temp file. */
async function downloadRangeToTemp(key) {
  const s3 = getS3();
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Range: `bytes=0-${RANGE_BYTES - 1}`,
  });
  const res = await s3.send(command);
  if (!res.Body) throw new Error('Empty response body from R2');

  const tmpPath = path.join(os.tmpdir(), `thumb-src-${crypto.randomUUID()}`);
  const writeStream = fs.createWriteStream(tmpPath);

  await new Promise((resolve, reject) => {
    // AWS SDK v3 Body is a web ReadableStream in Node 18+
    const { Readable } = require('stream');
    const nodeStream = res.Body.pipe ? res.Body : Readable.fromWeb(res.Body);
    nodeStream.pipe(writeStream);
    nodeStream.on('error', reject);
    writeStream.on('error', reject);
    writeStream.on('finish', resolve);
  });

  return tmpPath;
}

/** Run ffmpeg on a local file, extracting one frame as a small JPEG. */
function extractFrameLocal(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const args = [
      '-y',
      '-ss', String(SEEK_SECONDS),
      '-i', inputPath,
      '-frames:v', '1',
      '-vf', 'scale=480:-2',
      '-q:v', '4',
      outputPath,
    ];
    const proc = spawn(ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'] });

    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error('ffmpeg timed out'));
    }, FFMPEG_TIMEOUT_MS);

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0 && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-300)}`));
      }
    });
  });
}

function safeUnlink(p) {
  fs.unlink(p, () => {}); // best-effort, ignore errors
}

/**
 * Generate a thumbnail for a raw-footage video key and upload it to R2
 * alongside the source, under .thumbnails/<key>.jpg. Throws on failure —
 * callers (queue worker) are responsible for marking the job failed.
 */
async function generateThumbnail(key) {
  const srcTmp = await downloadRangeToTemp(key);
  const outTmp = path.join(os.tmpdir(), `thumb-out-${crypto.randomUUID()}.jpg`);

  try {
    await extractFrameLocal(srcTmp, outTmp);
    const jpegBuffer = fs.readFileSync(outTmp);
    const destKey = thumbnailKeyFor(key);
    await putObject(destKey, jpegBuffer, 'image/jpeg');
    return destKey;
  } finally {
    safeUnlink(srcTmp);
    safeUnlink(outTmp);
  }
}

module.exports = {
  isVideoKey,
  isRawFootageKey,
  shouldThumbnail,
  thumbnailKeyFor,
  generateThumbnail,
  THUMBNAIL_PREFIX,
};