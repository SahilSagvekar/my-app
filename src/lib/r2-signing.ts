// src/lib/r2-signing.ts
//
// Worker-side versions of the six pure S3-API operations that e8-file-server
// used to do on its dedicated "uploads" container instance:
//
//   /presign-upload      /presign-download
//   /multipart/initiate  /multipart/part-url
//   /multipart/complete  /multipart/abort
//
// WHY: none of these touch file bytes — they are a signature computation or
// one small API call to R2. Running them in a container meant an 8 GiB
// instance was woken (and then billed for the next 45 minutes) every time
// anyone uploaded or downloaded a file. The Worker already holds the same R2
// credentials and already signs URLs with them all over the app (see
// src/lib/s3.ts and e.g. hiring/test/[token]/upload-url), so it can do this
// work itself for the cost of a few milliseconds of CPU.
//
// BEHAVIOUR CONTRACT: every function below mirrors the matching handler in
// e8-file-server/src/index.js + s3.js line for line — same commands, same
// parameters, same expiry, same return shape. Nothing here is called
// directly by routes: src/lib/file-server.ts wraps each one and falls back
// to the container (the old path, still fully intact) on ANY failure, so the
// container's response stays the authoritative answer whenever the two could
// differ.
//
// SAFETY NET: before the Worker's own signatures are trusted, each isolate
// proves end to end that R2 accepts them (see signingSelfTest below). If the
// Worker's credentials are missing, stale or read-only — the "secrets drifted
// between e8-app and e8-file-server" class of incident — the self-test fails
// and everything quietly keeps going through the container exactly as before.
//
// KILL SWITCH: set R2_SIGNING=container on the e8-app Worker to force the old
// container path for everything, no redeploy of code needed.

import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  GetObjectCommand,
  PutObjectCommand,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getS3 } from '@/lib/s3';

// Same threshold and wording as e8-file-server's POST /multipart/initiate.
export const MULTIPART_THRESHOLD = 16 * 1024 * 1024; // 16 MB
const PRESIGN_EXPIRES_SECONDS = 3600; // every presign on the file server uses 3600

const CONTROL_TIMEOUT_MS = 15_000; // create / abort — normally well under a second
const COMPLETE_TIMEOUT_MS = 60_000; // complete can take longer on very large uploads

// Same default bucket as both src/lib/s3.ts and e8-file-server/src/s3.js.
function bucket(): string {
  return process.env.AWS_S3_BUCKET || 'e8-app-r2-prod';
}

/**
 * True when this Worker is configured to talk to R2 at all. Without these the
 * shared S3 client in src/lib/s3.ts would point at AWS instead of R2, so the
 * container must keep doing the signing.
 */
export function isWorkerSigningConfigured(): boolean {
  if ((process.env.R2_SIGNING || '').toLowerCase() === 'container') return false;
  return !!(process.env.R2_ENDPOINT && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
}

// ─── Self-test ───────────────────────────────────────────────────────────────
// Proves, against the real bucket, the exact thing a browser upload depends
// on: that R2 accepts a write signed by THIS Worker's credentials through a
// presigned URL. It opens a throwaway multipart upload, PUTs one byte to a
// presigned UploadPart URL, then aborts the upload. An aborted multipart
// upload never becomes an object, so this leaves nothing in the bucket, fires
// no R2 event notification and uses no storage.
//
// The result is cached per isolate: a pass is trusted for 10 minutes, a fail
// is re-checked after 2 (so fixing a bad secret recovers on its own). While it
// is failing, callers use the container — today's behaviour.

const SELF_TEST_PASS_TTL_MS = 10 * 60_000;
const SELF_TEST_FAIL_TTL_MS = 2 * 60_000;
const SELF_TEST_TIMEOUT_MS = 10_000;

let selfTestState: { ok: boolean; checkedAt: number } | null = null;
let selfTestInFlight: Promise<boolean> | null = null;

async function runSigningSelfTest(): Promise<boolean> {
  const s3 = getS3();
  const Bucket = bucket();
  const Key = `__signing-self-test/${crypto.randomUUID()}`;
  let UploadId: string | undefined;

  try {
    const created = await s3.send(
      new CreateMultipartUploadCommand({ Bucket, Key, ContentType: 'application/octet-stream' }),
      { abortSignal: AbortSignal.timeout(SELF_TEST_TIMEOUT_MS) },
    );
    UploadId = created.UploadId;
    if (!UploadId) throw new Error('R2 returned no UploadId');

    const url = await getSignedUrl(
      s3,
      new UploadPartCommand({ Bucket, Key, UploadId, PartNumber: 1 }),
      { expiresIn: 300 },
    );
    const put = await fetch(url, { method: 'PUT', body: 'x', signal: AbortSignal.timeout(SELF_TEST_TIMEOUT_MS) });
    if (!put.ok) {
      const body = await put.text().catch(() => '');
      throw new Error(`presigned UploadPart was rejected: ${put.status} ${body.slice(0, 200)}`);
    }
    return true;
  } catch (err: any) {
    console.warn(`[r2-signing] self-test failed — signing stays on the file server: ${err?.message || err}`);
    return false;
  } finally {
    if (UploadId) {
      await s3
        .send(new AbortMultipartUploadCommand({ Bucket, Key, UploadId }), {
          abortSignal: AbortSignal.timeout(SELF_TEST_TIMEOUT_MS),
        })
        .catch((err: any) => console.warn('[r2-signing] self-test cleanup failed:', err?.message));
    }
  }
}

/** Whether this isolate may sign with its own credentials right now. Never throws. */
export async function canSignInWorker(): Promise<boolean> {
  if (!isWorkerSigningConfigured()) return false;

  const now = Date.now();
  if (selfTestState) {
    const ttl = selfTestState.ok ? SELF_TEST_PASS_TTL_MS : SELF_TEST_FAIL_TTL_MS;
    if (now - selfTestState.checkedAt < ttl) return selfTestState.ok;
  }

  if (!selfTestInFlight) {
    selfTestInFlight = runSigningSelfTest()
      .catch(() => false)
      .then((ok) => {
        selfTestState = { ok, checkedAt: Date.now() };
        selfTestInFlight = null;
        return ok;
      });
  }
  return selfTestInFlight;
}

/**
 * Called when an operation that passed the self-test still failed in the
 * Worker (and was handed to the file server). Makes the next call re-run the
 * self-test instead of trusting a pass that may have gone stale — e.g. the R2
 * token was rotated a minute ago. At most one extra self-test per 30 seconds,
 * so a run of unrelated errors (a bad ETag, a malformed key) cannot turn into
 * a stream of probes.
 */
export function noteWorkerSigningFailure(): void {
  if (selfTestState?.ok && Date.now() - selfTestState.checkedAt > 30_000) selfTestState = null;
}

/** Test hook: forget the cached self-test result. */
export function resetSigningSelfTest(): void {
  selfTestState = null;
  selfTestInFlight = null;
}

// ─── Mirrors of the file server's handlers ───────────────────────────────────

/**
 * Thrown for an outcome the file server would also have reported — the caller
 * must surface it as-is rather than retrying through the container. Carries
 * the same `message` and `Code` the container path produces today.
 */
export class DefinitiveSigningError extends Error {
  Code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.Code = code;
  }
}

/** POST /presign-upload — body { key, contentType } → { uploadUrl, fileUrl, key } */
export async function presignUploadInWorker(key: string, contentType: string) {
  if (!key) throw new Error('key is required');
  // The container builds fileUrl from ITS R2_PUBLIC_URL. If this Worker has no
  // value of its own we cannot reproduce that string, so let the container answer.
  if (!process.env.R2_PUBLIC_URL) throw new Error('R2_PUBLIC_URL is not set on this Worker');

  const uploadUrl = await getSignedUrl(
    getS3(),
    new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType || 'application/octet-stream' }),
    { expiresIn: PRESIGN_EXPIRES_SECONDS },
  );
  const fileUrl = `${process.env.R2_PUBLIC_URL}/${key}`;
  return { uploadUrl, fileUrl, key };
}

/** POST /presign-download — body { s3Key, fileName } → { downloadUrl } */
export async function presignDownloadInWorker(s3Key: string, fileName?: string) {
  if (!s3Key) throw new Error('s3Key is required');
  const name = fileName || s3Key.split('/').pop() || 'download';
  const downloadUrl = await getSignedUrl(
    getS3(),
    new GetObjectCommand({
      Bucket: bucket(),
      Key: decodeURIComponent(s3Key),
      ResponseContentDisposition: `attachment; filename="${encodeURIComponent(name)}"`,
    }),
    { expiresIn: PRESIGN_EXPIRES_SECONDS },
  );
  return { downloadUrl };
}

/** POST /multipart/initiate — body { key, fileType, fileSize } → { uploadId, key } */
export async function initiateMultipartInWorker(key: string, fileType: string, fileSize?: number) {
  if (!key || !fileType) throw new Error('key and fileType are required');

  // R2/S3 requires all parts except the last to be >= 5 MB, so files under
  // 16 MB use a single presigned PUT instead. Same test, message and code as
  // the file server — /api/upload/initiate keys off Code === 'USE_SINGLE_PUT'.
  if (fileSize && fileSize < MULTIPART_THRESHOLD) {
    throw new DefinitiveSigningError('File too small for multipart upload', 'USE_SINGLE_PUT');
  }

  const { UploadId } = await getS3().send(
    new CreateMultipartUploadCommand({ Bucket: bucket(), Key: key, ContentType: fileType }),
    { abortSignal: AbortSignal.timeout(CONTROL_TIMEOUT_MS) },
  );
  if (!UploadId) throw new Error('Failed to get UploadId from R2');
  return { uploadId: UploadId, key };
}

/** POST /multipart/part-url — body { key, uploadId, partNumber } → { presignedUrl } */
export async function getPartUrlInWorker(key: string, uploadId: string, partNumber: number) {
  if (!key || !uploadId || !partNumber) throw new Error('key, uploadId, partNumber are required');
  const presignedUrl = await getSignedUrl(
    getS3(),
    new UploadPartCommand({ Bucket: bucket(), Key: key, UploadId: uploadId, PartNumber: partNumber }),
    { expiresIn: PRESIGN_EXPIRES_SECONDS },
  );
  return { presignedUrl };
}

/**
 * POST /multipart/complete — body { key, uploadId, parts } → { success, etag, location }
 *
 * Only the success case is handled here. Every error (NoSuchUpload,
 * InvalidPart, a timeout, …) is thrown so the caller hands the same request to
 * the container, whose existing error handling — including the "completion
 * replay" recovery for a lost success response — then produces exactly the
 * response it produces today.
 */
export async function completeMultipartInWorker(
  key: string,
  uploadId: string,
  parts: Array<{ ETag: string; PartNumber: number }>,
) {
  if (!key || !uploadId || !parts) throw new Error('key, uploadId, parts are required');
  const result = await getS3().send(
    new CompleteMultipartUploadCommand({
      Bucket: bucket(),
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts },
    }),
    { abortSignal: AbortSignal.timeout(COMPLETE_TIMEOUT_MS) },
  );
  return { success: true as const, etag: result.ETag, location: result.Location };
}

/** POST /multipart/abort — body { key, uploadId } */
export async function abortMultipartInWorker(key: string, uploadId: string): Promise<void> {
  if (!key || !uploadId) throw new Error('key and uploadId are required');
  await getS3().send(
    new AbortMultipartUploadCommand({ Bucket: bucket(), Key: key, UploadId: uploadId }),
    { abortSignal: AbortSignal.timeout(CONTROL_TIMEOUT_MS) },
  );
}

// ─── Thumbnail eligibility (mirrors e8-file-server/src/thumbnail.js) ─────────
// The file server queued a thumbnail job from inside /multipart/complete. Now
// that completion happens in the Worker, the Worker has to ask for that job
// (POST /thumbnail/retry runs the file server's own, unchanged eligibility
// check and enqueue). These are the same cheap, string-only tests the file
// server applies first, used so that uploads which could never get a
// thumbnail (images, PDFs, anything outside raw-footage/ and outputs/) do
// not wake the container at all.

const THUMBNAIL_VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'm4v', 'avi', 'mkv', 'webm', 'mxf', 'mts', 'm2ts']);
const KNOWN_OUTPUT_SUBFOLDERS = new Set(['thumbnails', 'music-license', 'covers', 'tiles']);

function isThumbnailVideoKey(key: string): boolean {
  const ext = key.split('.').pop()?.toLowerCase();
  return THUMBNAIL_VIDEO_EXTENSIONS.has(ext || '');
}

function isRawFootageVideoKey(key: string): boolean {
  if (!isThumbnailVideoKey(key)) return false;
  const ancestors = key.split('/').filter(Boolean).slice(0, -1);
  return ancestors.includes('raw-footage');
}

function isOutputMainVideoKey(key: string): boolean {
  if (!isThumbnailVideoKey(key)) return false;
  const parts = key.split('/').filter(Boolean);
  if (parts.length < 2) return false;
  const ancestors = parts.slice(0, -1);
  const outputsIdx = ancestors.indexOf('outputs');
  if (outputsIdx === -1) return false;
  if (outputsIdx === ancestors.length - 1) return false;
  return !KNOWN_OUTPUT_SUBFOLDERS.has(ancestors[ancestors.length - 1]);
}

/** Could the file server possibly queue a thumbnail for this key? */
export function mayNeedThumbnail(key: string): boolean {
  return isRawFootageVideoKey(key) || isOutputMainVideoKey(key);
}
