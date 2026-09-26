// src/lib/shoot-notify.ts
//
// Client-facing notifications for shoot day scheduling/cancellation — pulled
// out of the /api/shoots routes so POST (create) and PATCH (edit/cancel)
// can share the same client-lookup + ics-building logic.

import { getDbHttp } from '@/lib/db';
import { client as clientTable, user as userTable } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { buildShootCalendarInvite, buildGoogleCalendarLink } from '@/lib/calendar-invite';
import { sendShootScheduledEmail, sendShootCancelledEmail, sendHostShootEmail } from '@/lib/email';

async function getClientContact(clientId: string): Promise<{ name: string; emails: string[] } | null> {
  const db = getDbHttp();
  const [c] = await db
    .select({
      name: clientTable.name,
      companyName: clientTable.companyName,
      email: clientTable.email,
      emails: clientTable.emails,
    })
    .from(clientTable)
    .where(eq(clientTable.id, clientId))
    .limit(1);
  if (!c) return null;

  const primary = (c.email || '').trim();
  const extra = (c.emails || []).map((e: string | null) => (e || '').trim()).filter(Boolean);
  const emails = Array.from(new Set([primary, ...extra].filter(Boolean)));
  return { name: c.companyName || c.name || 'there', emails };
}

export async function notifyClientShootScheduled(opts: {
  taskId: string;
  clientId: string;
  taskTitle: string;
  location?: string | null;
  hostName?: string | null;
  start: Date;
  end: Date;
}) {
  try {
    const client = await getClientContact(opts.clientId);
    if (!client || client.emails.length === 0) {
      console.log(`[ShootNotify] No client email on file for ${opts.clientId} — skipping scheduled notice`);
      return;
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const organizerEmail = process.env.SMTP_USER || 'no-reply@e8productions.com';

    const description = `E8 Productions shoot day${opts.location ? ` at ${opts.location}` : ''}.`;

    const icsContent = buildShootCalendarInvite({
      uid: `shoot-${opts.taskId}@e8productions.com`,
      method: 'REQUEST',
      sequence: Math.floor(Date.now() / 1000),
      title: `Shoot: ${opts.taskTitle}`,
      description,
      location: opts.location,
      start: opts.start,
      end: opts.end,
      organizerEmail,
      organizerName: 'E8 Productions',
      attendees: client.emails.map((email) => ({ email })),
    });

    const googleCalendarUrl = buildGoogleCalendarLink({
      title: `Shoot: ${opts.taskTitle}`,
      description,
      location: opts.location,
      start: opts.start,
      end: opts.end,
    });

    await sendShootScheduledEmail({
      clientEmails: client.emails,
      clientName: client.name,
      taskTitle: opts.taskTitle,
      location: opts.location,
      hostName: opts.hostName,
      start: opts.start,
      end: opts.end,
      portalUrl: `${appUrl}/client`,
      icsContent,
      googleCalendarUrl,
    });
  } catch (err) {
    console.error('[ShootNotify] Failed to send shoot scheduled email:', err);
  }
}

export async function notifyClientShootCancelled(opts: {
  taskId: string;
  clientId: string;
  taskTitle: string;
  start: Date;
  end: Date;
  reason?: string | null;
}) {
  try {
    const client = await getClientContact(opts.clientId);
    if (!client || client.emails.length === 0) return;

    const organizerEmail = process.env.SMTP_USER || 'no-reply@e8productions.com';

    const icsContent = buildShootCalendarInvite({
      uid: `shoot-${opts.taskId}@e8productions.com`,
      method: 'CANCEL',
      sequence: Math.floor(Date.now() / 1000),
      title: `Shoot: ${opts.taskTitle}`,
      start: opts.start,
      end: opts.end,
      organizerEmail,
      organizerName: 'E8 Productions',
      attendees: client.emails.map((email) => ({ email })),
    });

    await sendShootCancelledEmail({
      clientEmails: client.emails,
      clientName: client.name,
      taskTitle: opts.taskTitle,
      start: opts.start,
      reason: opts.reason,
      icsContent,
    });
  } catch (err) {
    console.error('[ShootNotify] Failed to send shoot cancelled email:', err);
  }
}

/**
 * Tells a host about their booking (assigned / updated) or that it was
 * cancelled / they were taken off it. The host's own calendar invite uses a
 * different UID from the client's so the two never overwrite each other.
 * Never throws — a failed email must not fail the shoot save.
 */
export async function notifyHostShoot(opts: {
  kind: 'assigned' | 'updated' | 'cancelled';
  hostId: number;
  taskId: string;
  clientId?: string | null;
  taskTitle: string;
  location?: string | null;
  role?: string | null;
  wardrobe?: string | null;
  start: Date;
  end: Date;
}) {
  try {
    const db = getDbHttp();
    const [host] = await db
      .select({ name: userTable.name, email: userTable.email })
      .from(userTable)
      .where(eq(userTable.id, opts.hostId))
      .limit(1);
    if (!host?.email) {
      console.log(`[ShootNotify] Host ${opts.hostId} has no email — skipping ${opts.kind} notice`);
      return;
    }

    let clientName = opts.taskTitle;
    if (opts.clientId) {
      const c = await getClientContact(opts.clientId);
      if (c?.name) clientName = c.name;
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const organizerEmail = process.env.SMTP_USER || 'no-reply@e8productions.com';
    const cancelled = opts.kind === 'cancelled';
    const description = `E8 Productions shoot for ${clientName}${opts.location ? ` at ${opts.location}` : ''}.`;

    const icsContent = buildShootCalendarInvite({
      uid: `shoot-${opts.taskId}-host-${opts.hostId}@e8productions.com`,
      method: cancelled ? 'CANCEL' : 'REQUEST',
      sequence: Math.floor(Date.now() / 1000),
      title: `Shoot: ${clientName}`,
      description,
      location: opts.location,
      start: opts.start,
      end: opts.end,
      organizerEmail,
      organizerName: 'E8 Productions',
      attendees: [{ email: host.email, name: host.name || undefined }],
    });

    await sendHostShootEmail({
      kind: opts.kind,
      hostEmail: host.email,
      hostName: host.name || 'there',
      clientName,
      start: opts.start,
      end: opts.end,
      location: opts.location,
      role: opts.role,
      wardrobe: opts.wardrobe,
      portalUrl: `${appUrl}/`,
      icsContent,
    });
  } catch (err) {
    console.error('[ShootNotify] Failed to send host shoot email:', err);
  }
}
