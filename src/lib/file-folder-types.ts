/** Folder types that allow multiple concurrent active files per task. */
export const MULTI_ASSET_FOLDER_TYPES = [
  'thumbnails',
  'music-license',
  'covers',
  'tiles',
] as const;

export type MultiAssetFolderType = (typeof MULTI_ASSET_FOLDER_TYPES)[number];

export function isMultiAssetFolderType(
  folderType: string | null | undefined,
): folderType is MultiAssetFolderType {
  return (
    !!folderType &&
    (MULTI_ASSET_FOLDER_TYPES as readonly string[]).includes(folderType)
  );
}

/**
 * Whether a newly uploaded file should deactivate the previous active file
 * in the same folderType (version replace).
 *
 * Multi-asset folders always keep every upload.
 * Image uploads on `main` (Hard Posts / graphic images, story stills, etc.)
 * also accumulate — only main *videos* version-replace.
 */
export function shouldVersionReplaceUpload(
  folderType: string | null | undefined,
  mimeType: string | null | undefined,
): boolean {
  if (isMultiAssetFolderType(folderType)) return false;
  if ((mimeType || '').startsWith('image/')) return false;
  return true;
}
