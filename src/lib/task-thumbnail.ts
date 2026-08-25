// Shared task-card thumbnail resolution for QC + client dashboards.
// Prefers folderType=thumbnails File rows (including auto-generated ones),
// then any image on the task. Optionally falls back to the known auto-thumb
// R2 key pattern (.thumbnails/{videoS3Key}.jpg) so cards can show a frame
// even before/without a File row if that object already exists in storage.

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
 * Resolve the best thumbnail URL for a task card.
 * `buildAutoThumbUrl` is optional — when provided, used as a last-resort
 * candidate from the main video's s3Key (caller supplies getFileUrl).
 */
export function getTaskCardThumbnailUrl(
  files: ThumbnailFileLike[] | null | undefined,
  opts?: {
    buildAutoThumbUrl?: (videoS3Key: string) => string;
  }
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

  // Last resort: derived auto-thumb URL from an active main video.
  // The <img> onError handler still falls back to "No thumbnail" if missing.
  if (opts?.buildAutoThumbUrl) {
    const mainVideo = files.find(
      (f) =>
        f.folderType === 'main' &&
        active(f) &&
        f.s3Key &&
        (f.mimeType?.startsWith('video/') || /\.(mp4|mov|m4v|webm|mkv)$/i.test(f.s3Key))
    );
    if (mainVideo?.s3Key) {
      return opts.buildAutoThumbUrl(mainVideo.s3Key);
    }
  }

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
