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
