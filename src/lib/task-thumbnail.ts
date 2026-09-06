// Shared task-card thumbnail resolution for QC + client dashboards.
// Prefers folderType=thumbnails File rows (including auto-generated ones),
// then any image on the task. No longer guesses at an R2 key for videos
// that don't have a thumbnails File row yet — that path (buildAutoThumbUrl)
// was removed because it assumed the auto-thumb existed without checking,
// producing 404s whenever generation hadn't finished (or failed) yet. The
// every-minute backfill cron (src/lib/backfill-task-thumbnails.ts) is what
// actually creates the File row once a real thumbnail exists in R2 — until
// then, cards show the "Generating…" fallback label below.

export type ThumbnailFileLike = {
  url?: string | null;
  mimeType?: string | null;
  name?: string | null;
  folderType?: string | null;
  isActive?: boolean | null;
  s3Key?: string | null;
};

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif)$/i;
export const AUTO_THUMBNAIL_PREFIX = '.thumbnails/';

export function isLikelyImageFile(f: ThumbnailFileLike): boolean {
  if (f.mimeType?.startsWith('image/')) return true;
  if (f.name && IMAGE_EXT.test(f.name)) return true;
  if (f.url && IMAGE_EXT.test(f.url.split('?')[0])) return true;
  if (f.s3Key && IMAGE_EXT.test(f.s3Key)) return true;
  return false;
}

export function autoThumbnailKeyForVideo(videoS3Key: string): string {
  return `${AUTO_THUMBNAIL_PREFIX}${videoS3Key}.jpg`;
}

/**
 * Resolve the best thumbnail URL for a task card. Returns null if no real
 * thumbnails File row exists yet — callers should show
 * taskThumbnailFallbackLabel() in that case rather than guessing a URL.
 */
export function getTaskCardThumbnailUrl(
  files: ThumbnailFileLike[] | null | undefined
): string | null {
  if (!files || files.length === 0) return null;

  const active = (f: ThumbnailFileLike) => f.isActive !== false;

  const thumb =
    files.find(
      (f) => f.folderType === 'thumbnails' && active(f) && isLikelyImageFile(f) && f.url
    ) ||
    files.find((f) => f.folderType === 'thumbnails' && active(f) && f.url);

  if (thumb?.url) return thumb.url;

  const anyActiveImage = files.find((f) => active(f) && isLikelyImageFile(f) && f.url);
  if (anyActiveImage?.url) return anyActiveImage.url;

  const anyImage = files.find((f) => isLikelyImageFile(f) && f.url);
  if (anyImage?.url) return anyImage.url;

  return null;
}

export function taskHasThumbnailFiles(
  files: ThumbnailFileLike[] | null | undefined
): boolean {
  if (!files?.length) return false;
  return files.some(
    (f) => f.folderType === 'thumbnails' && f.isActive !== false && (isLikelyImageFile(f) || !!f.url)
  );
}

const VIDEO_EXT = /\.(mp4|mov|m4v|webm|mkv)$/i;

/** True when the task has an active main video that can get an auto-thumb. */
export function taskHasMainVideo(
  files: ThumbnailFileLike[] | null | undefined
): boolean {
  if (!files?.length) return false;
  return files.some(
    (f) =>
      f.folderType === 'main' &&
      f.isActive !== false &&
      !!f.s3Key &&
      (f.mimeType?.startsWith('video/') || VIDEO_EXT.test(f.s3Key) || (!!f.name && VIDEO_EXT.test(f.name)))
  );
}

/**
 * Label under the card media plane when no image is showing.
 * Prefer "Generating…" when a main video exists so QC/client don't read as empty.
 */
export function taskThumbnailFallbackLabel(
  files: ThumbnailFileLike[] | null | undefined
): string {
  if (taskHasMainVideo(files) && !taskHasThumbnailFiles(files)) return 'Generating…';
  return 'No thumbnail';
}