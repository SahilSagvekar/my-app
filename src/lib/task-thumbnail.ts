// Shared task-card thumbnail resolution for QC + client dashboards.
// Prefers folderType=thumbnails File rows, then any image on the task.
// There is no auto-generation anymore — the only way a thumbnails File row
// exists is an editor uploading one manually (src/components/workflow/
// TaskUploadSections.tsx, folderType: "thumbnails"). No R2-key guessing:
// we only ever show a thumbnail once a real File row for it exists.

export type ThumbnailFileLike = {
  url?: string | null;
  mimeType?: string | null;
  name?: string | null;
  folderType?: string | null;
  isActive?: boolean | null;
  s3Key?: string | null;
};

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif)$/i;

export function isLikelyImageFile(f: ThumbnailFileLike): boolean {
  if (f.mimeType?.startsWith('image/')) return true;
  if (f.name && IMAGE_EXT.test(f.name)) return true;
  if (f.url && IMAGE_EXT.test(f.url.split('?')[0])) return true;
  if (f.s3Key && IMAGE_EXT.test(f.s3Key)) return true;
  return false;
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

/** Label under the card media plane when no image is showing. */
export function taskThumbnailFallbackLabel(
  _files: ThumbnailFileLike[] | null | undefined
): string {
  return 'No thumbnail';
}