// src/lib/format-folder-display-name.ts
//
// Display-only formatting for folder names shown in the Files/Drive UI.
// Deliberately does NOT touch the underlying S3 key, DB folderType value,
// or any internal routing/comparison logic anywhere else in the app —
// those all keep using the real, unmodified strings (e.g. "raw-footage",
// "August-2026"). This only changes what gets rendered.
//
// Scoped to two known-safe cases rather than a blind "capitalize every
// word, strip every hyphen" transform, because task-title folders can
// legitimately contain hyphens that aren't meant to be touched — e.g. a
// date embedded in a task folder name like "AcmeCorp_08-24-2026_SF1".
// Blindly stripping hyphens there would turn a date into "08 24 2026",
// which is actively worse. Deliverable-type folders (e.g. "Short Form
// Videos") are already Title Case at the source (deliverable-folder-name.ts)
// and don't need any transform — they pass through untouched too.

// Known static path segments that are always lowercase/hyphenated at the
// storage layer. Add to this list if a new static segment is introduced.
const KNOWN_SEGMENT_LABELS: Record<string, string> = {
  'raw-footage': 'Raw Footage',
  'music-license': 'Music License',
  'outputs': 'Outputs',
  'thumbnails': 'Thumbnails',
  'tiles': 'Tiles',
  'essentials': 'Essentials',
  'elements': 'Elements',
};

// Month folders: "August-2026" -> "August 2026". Matches the same shape
// month-folder.ts's parseMonthFolder() expects — this only changes display,
// so that parser (and everything that sorts/filters on the real value)
// keeps working against the untouched underlying string.
const MONTH_FOLDER_RE = /^([A-Za-z]+)-(\d{4})$/;

export function formatFolderDisplayName(name: string): string {
  const lower = name.toLowerCase();
  if (KNOWN_SEGMENT_LABELS[lower]) return KNOWN_SEGMENT_LABELS[lower];

  const monthMatch = name.match(MONTH_FOLDER_RE);
  if (monthMatch) {
    const [, monthName, year] = monthMatch;
    const properMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1).toLowerCase();
    return `${properMonth} ${year}`;
  }

  // Everything else (task-title folders, deliverable-type folders,
  // uploaded filenames) is left exactly as-is.
  return name;
}