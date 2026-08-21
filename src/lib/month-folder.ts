// src/lib/month-folder.ts
//
// Single source of truth for parsing "Month-YYYY" folder-name strings (e.g.
// "August-2026") into real dates for chronological sorting. These strings
// show up all over the app — task.monthFolder, R2 folder paths under
// raw-footage/ and outputs/, dropdown filters — and a plain string sort on
// them is wrong (alphabetically, "August-2026" sorts before
// "December-2025", even though December 2025 is actually earlier).
//
// Previously duplicated as a private, unexported function inside
// nas-archival.ts — pulled out here so it has exactly one definition.

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** "August-2026" -> Date(2026, 7, 1). Returns null if the string doesn't
 *  match the expected "Month-YYYY" shape. */
export function parseMonthFolder(monthFolder: string): Date | null {
  const match = monthFolder.match(/^([A-Za-z]+)-(\d{4})$/);
  if (!match) return null;
  const [, monthName, yearStr] = match;
  const monthIndex = MONTH_NAMES.findIndex(m => m === monthName);
  const year = Number(yearStr);
  if (monthIndex === -1 || !Number.isFinite(year)) return null;
  return new Date(year, monthIndex, 1);
}

/** Sorts an array of "Month-YYYY" strings chronologically. Entries that
 *  don't parse are pushed to the end (stable, never dropped) rather than
 *  breaking the sort or silently disappearing. */
export function sortMonthFolders(months: string[], order: 'asc' | 'desc' = 'desc'): string[] {
  const withDates = months.map(m => ({ month: m, date: parseMonthFolder(m) }));
  withDates.sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1; // unparseable entries go last regardless of direction
    if (!b.date) return -1;
    return order === 'desc'
      ? b.date.getTime() - a.date.getTime()
      : a.date.getTime() - b.date.getTime();
  });
  return withDates.map(w => w.month);
}