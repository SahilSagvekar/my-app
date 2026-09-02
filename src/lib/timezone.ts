// src/lib/timezone.ts
//
// The scheduler portal's "posted content" timestamps (social media link
// postedAt) must always read in US Eastern time, no matter where the
// person viewing/editing is physically located or what their browser's
// local timezone is set to. Using the IANA zone "America/New_York" (not
// a fixed UTC-5 offset) so this correctly follows EST/EDT daylight-saving
// transitions rather than being wrong for half the year.

export const EST_TIMEZONE = 'America/New_York';

// Display label shown next to formatted times so it's unambiguous to
// someone viewing from a different zone that this is NOT their local time.
function estLabel(date: Date): string {
    // Intl reports "EST" or "EDT" for America/New_York depending on the date.
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: EST_TIMEZONE,
        timeZoneName: 'short',
    }).formatToParts(date);
    return parts.find((p) => p.type === 'timeZoneName')?.value || 'ET';
}

/**
 * Formats a date/ISO-string in US Eastern time, with the zone abbreviation
 * appended (e.g. "Sep 2, 2:00 PM EDT"). Use for any "posted content"
 * timestamp shown in the scheduler portal.
 */
export function formatInEST(
    input: string | Date,
    options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }
): string {
    const date = typeof input === 'string' ? new Date(input) : input;
    if (isNaN(date.getTime())) return 'N/A';
    const formatted = new Intl.DateTimeFormat('en-US', { ...options, timeZone: EST_TIMEZONE }).format(date);
    return `${formatted} ${estLabel(date)}`;
}

/**
 * Converts a stored UTC instant into an "America/New_York" wall-clock
 * string suitable for pre-filling an <input type="datetime-local">
 * (format: YYYY-MM-DDTHH:mm) — so editing a posted time always starts
 * from the EST reading, not the editor's own local clock.
 */
export function utcToESTWallClock(input: string | Date): string {
    const date = typeof input === 'string' ? new Date(input) : input;
    if (isNaN(date.getTime())) return '';
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: EST_TIMEZONE,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(date);
    const get = (type: string) => parts.find((p) => p.type === type)?.value || '00';
    return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

/**
 * Converts a datetime-local input value (e.g. "2026-09-02T14:00"), which
 * has no timezone of its own, into the correct UTC ISO string — treating
 * the entered numbers as EST/EDT wall-clock time regardless of which
 * timezone the browser typing it is actually in.
 *
 * Standard "anchor + diff" trick: parsing the same naive string in the
 * browser's own zone twice (once directly, once round-tripped through the
 * target zone) isolates exactly the EST-vs-UTC offset at that date,
 * correctly handling DST, independent of the browser's own timezone.
 */
export function estWallClockToUTC(dateTimeLocalStr: string): string {
    if (!dateTimeLocalStr) return new Date().toISOString();
    const naive = new Date(dateTimeLocalStr);
    if (isNaN(naive.getTime())) return new Date().toISOString();
    const roundTripped = new Date(naive.toLocaleString('en-US', { timeZone: EST_TIMEZONE }));
    const diff = naive.getTime() - roundTripped.getTime();
    return new Date(naive.getTime() + diff).toISOString();
}