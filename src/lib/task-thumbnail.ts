// Shared task-card thumbnail resolution for QC + client dashboards.
// The newest editor-uploaded thumbnail wins; when none exists, the API-added
// generated preview for the newest active video is the fallback.

export type ThumbnailFileLike = {
  url?: string | null;
  mimeType?: string | null;
  name?: string | null;
  folderType?: string | null;
  isActive?: boolean | null;
  s3Key?: string | null;
  uploadedAt?: string | Date | null;
  createdAt?: string | Date | null;
  // Added by task APIs for a video whose generated preview is READY.
  previewUrl?: string | null;
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

  // Editors can upload several thumbnail concepts. The product rule is that
  // the newest active upload automatically becomes the task-card cover.
  const newestFirst = [...files].sort((a, b) => {
    const aTime = new Date(a.uploadedAt || a.createdAt || 0).getTime();
    const bTime = new Date(b.uploadedAt || b.createdAt || 0).getTime();
    return bTime - aTime;
  });

  const thumb =
    newestFirst.find(
      (f) => f.folderType === 'thumbnails' && active(f) && isLikelyImageFile(f) && f.url
    ) ||
    newestFirst.find((f) => f.folderType === 'thumbnails' && active(f) && f.url);

  if (thumb?.url) return thumb.url;

  // No editor thumbnail: use the generated preview of the newest active
  // video. This is deliberately after manual images, so an editor's newest
  // thumbnail always wins for QC and client task cards.
  const generatedPreview = newestFirst.find(
    (f) => active(f) && f.mimeType?.startsWith('video/') && f.previewUrl
  );
  if (generatedPreview?.previewUrl) return generatedPreview.previewUrl;

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
  files: ThumbnailFileLike[] | null | undefined
): string {
  const hasPendingVideo = files?.some(f => f.isActive !== false && f.mimeType?.startsWith('video/'));
  return hasPendingVideo ? 'Generating preview…' : 'No thumbnail';
}
