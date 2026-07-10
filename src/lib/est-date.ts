export const EST_TZ = 'America/New_York';

/**
 * Extract the calendar date parts (year, month, day, weekday) as seen in EST.
 * Uses Intl.DateTimeFormat — reliable across all Node/V8 versions.
 */
export function getESTParts(now: Date): { year: number; month: number; day: number; weekday: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: EST_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });
  const parts = fmt.formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    year: parseInt(get('year'), 10),
    month: parseInt(get('month'), 10) - 1, // 0-indexed
    day: parseInt(get('day'), 10),
    weekday: weekdayMap[get('weekday')] ?? 0,
  };
}

/**
 * Build a UTC Date that represents midnight (or end-of-day) of the given
 * EST calendar date. We do this by constructing an ISO string with the
 * America/New_York offset for that instant.
 */
export function estCalendarToUTC(year: number, month0: number, day: number, endOfDay = false): Date {
  // Create a Date at noon EST on that day so DST can't shift us to the wrong calendar date
  const noon = new Date(`${year}-${String(month0 + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T12:00:00`);
  // Find the UTC offset for that timezone on that day
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: EST_TZ,
    hour: 'numeric',
    hour12: false,
    timeZoneName: 'shortOffset',
  });
  const parts = fmt.formatToParts(noon);
  const offsetStr = parts.find(p => p.type === 'timeZoneName')?.value ?? 'GMT-5'; // e.g. "GMT-4" or "GMT-5"
  const match = offsetStr.match(/GMT([+-]\d+)/);
  const offsetHours = match ? parseInt(match[1], 10) : -5;

  if (endOfDay) {
    // 23:59:59.999 EST = next day 00:00:00 UTC minus 1ms, adjusted for offset
    return new Date(Date.UTC(year, month0, day, 23 - offsetHours, 59, 59, 999));
  } else {
    // 00:00:00.000 EST
    return new Date(Date.UTC(year, month0, day, 0 - offsetHours, 0, 0, 0));
  }
}

export function getESTDate(date?: string): { start: Date; end: Date } {
  const now = date ? new Date(date) : new Date();
  const { year, month, day } = getESTParts(now);
  return {
    start: estCalendarToUTC(year, month, day, false),
    end: estCalendarToUTC(year, month, day, true),
  };
}

export function getESTDayOfWeek(date?: string): number {
  const now = date ? new Date(date) : new Date();
  return getESTParts(now).weekday;
}

/** YYYY-MM-DD calendar date as seen in EST — used as a dedup key for "today". */
export function getESTDateString(date?: string): string {
  const now = date ? new Date(date) : new Date();
  const { year, month, day } = getESTParts(now);
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function getESTMonthBounds(date?: string): { start: Date; end: Date } {
  const now = date ? new Date(date) : new Date();
  const { year, month } = getESTParts(now);
  const lastDay = new Date(year, month + 1, 0).getDate();
  return {
    start: estCalendarToUTC(year, month, 1, false),
    end: estCalendarToUTC(year, month, lastDay, true),
  };
}

export function getESTWeekBounds(date?: string): { start: Date; end: Date } {
  const now = date ? new Date(date) : new Date();
  const { year, month, day, weekday } = getESTParts(now);

  // Build a plain JS Date at midnight local (doesn't matter — we only use it for arithmetic)
  const estDay = new Date(year, month, day);

  // Monday of this week
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  const monday = new Date(estDay);
  monday.setDate(estDay.getDate() + mondayOffset);

  // Sunday of this week
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    start: estCalendarToUTC(monday.getFullYear(), monday.getMonth(), monday.getDate(), false),
    end: estCalendarToUTC(sunday.getFullYear(), sunday.getMonth(), sunday.getDate(), true),
  };
}
