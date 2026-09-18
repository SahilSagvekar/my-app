// src/lib/calendar-invite.ts
//
// Minimal RFC5545 .ics builder for shoot-day calendar invites — no external
// "ics" package in this repo, and the format needed here (single VEVENT,
// one organizer, one or more attendees, REQUEST/CANCEL) is small enough to
// hand-write instead of adding a dependency.

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

// RFC5545 requires folding lines longer than 75 octets, continuation lines
// starting with a single space.
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  let result = line.slice(0, 75);
  let rest = line.slice(75);
  while (rest.length > 0) {
    result += '\r\n ' + rest.slice(0, 74);
    rest = rest.slice(74);
  }
  return result;
}

function toIcsDateUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

export interface ShootCalendarInviteOptions {
  uid: string; // stable per-shoot identifier, e.g. `shoot-${taskId}@e8productions.com`
  method: 'REQUEST' | 'CANCEL';
  sequence: number; // must increase (or stay equal) across resends for the same uid
  title: string;
  description?: string;
  location?: string | null;
  start: Date;
  end: Date;
  organizerEmail: string;
  organizerName: string;
  attendees: { email: string; name?: string | null }[];
}

const DEFAULT_SHOOT_DURATION_MS = 2 * 60 * 60 * 1000; // 2h, when no planned end time is set

// Shoots track a single `shootDate` plus optional planned start/end times —
// prefer the planned window when both are present, otherwise fall back to
// shootDate with a 2h default length.
export function resolveShootWindow(opts: {
  shootDate: string | null;
  plannedStartTime?: string | null;
  plannedEndTime?: string | null;
}): { start: Date; end: Date } | null {
  const startIso = opts.plannedStartTime || opts.shootDate;
  if (!startIso) return null;
  const start = new Date(startIso);
  if (isNaN(start.getTime())) return null;
  const end = opts.plannedEndTime ? new Date(opts.plannedEndTime) : null;
  if (end && !isNaN(end.getTime()) && end.getTime() > start.getTime()) {
    return { start, end };
  }
  return { start, end: new Date(start.getTime() + DEFAULT_SHOOT_DURATION_MS) };
}

// The .ics attachment alone relies on the recipient's mail client rendering
// its own Accept/Decline UI from a `text/calendar` part — Gmail/Outlook do
// this sometimes, but it's inconsistent (depends on sending domain
// reputation, webmail vs app, etc.), so there was no visible way to accept
// the invite in practice. A plain link to Google Calendar's "add event" page
// always works, in any email client, regardless of ics rendering support.
export function buildGoogleCalendarLink(opts: {
  title: string;
  description?: string;
  location?: string | null;
  start: Date;
  end: Date;
}): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: opts.title,
    dates: `${toIcsDateUtc(opts.start)}/${toIcsDateUtc(opts.end)}`,
  });
  if (opts.description) params.set('details', opts.description);
  if (opts.location) params.set('location', opts.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function buildShootCalendarInvite(opts: ShootCalendarInviteOptions): string {
  const now = toIcsDateUtc(new Date());
  const dtStart = toIcsDateUtc(opts.start);
  const dtEnd = toIcsDateUtc(opts.end);
  const status = opts.method === 'CANCEL' ? 'CANCELLED' : 'CONFIRMED';

  const attendeeLines = opts.attendees.map((a) =>
    foldLine(
      `ATTENDEE;CN=${escapeIcsText(a.name || a.email)};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${a.email}`
    )
  );

  const lines = [
    'BEGIN:VCALENDAR',
    'PRODID:-//E8 Productions//E8 App//EN',
    'VERSION:2.0',
    `METHOD:${opts.method}`,
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${opts.uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    foldLine(`SUMMARY:${escapeIcsText(opts.title)}`),
    ...(opts.description ? [foldLine(`DESCRIPTION:${escapeIcsText(opts.description)}`)] : []),
    ...(opts.location ? [foldLine(`LOCATION:${escapeIcsText(opts.location)}`)] : []),
    foldLine(`ORGANIZER;CN=${escapeIcsText(opts.organizerName)}:mailto:${opts.organizerEmail}`),
    ...attendeeLines,
    `SEQUENCE:${opts.sequence}`,
    `STATUS:${status}`,
    'TRANSP:OPAQUE',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return lines.join('\r\n');
}
