/**
 * Display-only labels for deliverable types.
 *
 * Deliverable types reach the UI in several shapes ("LF", "Long Form Videos",
 * "long_form_videos", ...). Use this for what the user SEES in dropdowns and
 * badges; keep using the raw value for filtering and API calls.
 */
const LABELS: Record<string, string> = {
  lf: "Long Form Videos",
  longform: "Long Form Videos",
  longformvideo: "Long Form Videos",
  longformvideos: "Long Form Videos",

  sf: "Short Form Videos",
  shortform: "Short Form Videos",
  shortformvideo: "Short Form Videos",
  shortformvideos: "Short Form Videos",

  sqf: "Square Form Videos",
  squareform: "Square Form Videos",
  squareformvideo: "Square Form Videos",
  squareformvideos: "Square Form Videos",

  tp: "Text Post",
  textpost: "Text Post",
};

export function formatDeliverableType(type: string | null | undefined): string {
  if (!type) return "";
  const key = type.toLowerCase().replace(/[^a-z]/g, "");
  return LABELS[key] ?? type.replace(/_/g, " ");
}
