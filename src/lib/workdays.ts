// lib/workdays.ts

// inclusive date range, Sunday always off,
// Saturday depends on worksOnSaturday flag
export function countWorkingDaysBetween(
  start: Date,
  end: Date,
  worksOnSaturday: boolean
) {
  if (end < start) return 0;

  const d = new Date(start.getTime());
  let count = 0;

  while (d <= end) {
    const day = d.getUTCDay(); // 0 = Sun, 6 = Sat

    if (day === 0) {
      // Sunday off
    } else if (day === 6 && !worksOnSaturday) {
      // Saturday off for Mon–Fri people
    } else {
      count++;
    }

    d.setUTCDate(d.getUTCDate() + 1);
  }

  return count;
}
