// src/lib/deliverable-folder-name.ts
//
// Single source of truth for how a deliverable type becomes a folder name.
// Previously there were THREE different conventions for this across the
// codebase: short codes ("SF") in repair-folders.ts, an abbreviated form
// ("Short Form") in rename-folders/route.ts, and the real deliverable type
// string ("Short Form Videos") actually used by real uploads (see
// ClientManagement.tsx's dropdown and RawFootageUploadDialog.tsx). This
// collapses all three to one: the folder name IS the real deliverable type
// string, verbatim — with one deliberate exception below.

// "Hard Posts / Graphic Images" contains a literal "/", which is a path
// separator in S3/R2 keys — used as-is it would silently create an extra,
// unintended nested folder instead of one folder with that name. Shortened
// to "Hard Posts" for the folder name only; the full string is still the
// real DB `type` value everywhere else (dropdowns, task records, etc).
const FOLDER_NAME_OVERRIDES: Record<string, string> = {
  'Hard Posts / Graphic Images': 'Hard Posts',
};

export function getDeliverableFolderName(type: string): string {
  return FOLDER_NAME_OVERRIDES[type] ?? type;
}