// src/lib/announcements.ts
//
// "What's new" announcements. ONE Announcement row + per-user read receipts
// (AnnouncementRead) — no per-user fan-out of in-app rows, so people who join
// later still see announcements aimed at their role.
//
//   publishAnnouncement()      DRAFT/SCHEDULED -> PUBLISHED (atomic, idempotent)
//   publishDueAnnouncements()  cron: publishes SCHEDULED rows whose publishAt passed
//   sendEmailBatches()         cron: drains email delivery a few dozen at a time
//                              (never one big loop inside a single request)
//   getFeedForUser()           what the bell / popup shows for a viewer
//
// Email progress: `emailSentCount` is a *cursor* into the audience list ordered
// by user id (users who opted out of email are skipped but still advance it),
// and delivery is done when emailSentCount >= recipientCount.

import { getDbHttp } from '@/lib/db';
import { announcement, announcementRead, user as userTable } from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { and, arrayContains, arrayOverlaps, asc, desc, eq, gt, inArray, isNull, lte, ne, or, sql } from 'drizzle-orm';
import { sendRawEmail } from '@/lib/email';
import { renderEmailShell } from '@/lib/email-shell';
import { sendToChannel, type SlackChannel } from '@/lib/slack';

export const ANNOUNCEMENT_TYPES = ['NEW_FEATURE', 'UPDATE', 'MAINTENANCE', 'IMPORTANT'] as const;
export type AnnouncementType = (typeof ANNOUNCEMENT_TYPES)[number];

export const ANNOUNCEMENT_SLACK_CHANNELS = [
  'e8app', 'editors', 'qc', 'scheduling', 'reports', 'attendance', 'tdbs_guests', 'sales',
] as const;

export const ANNOUNCEMENT_ROLES = [
  'admin', 'manager', 'editor', 'videographer', 'scheduler', 'client', 'qc', 'sales', 'sales_manager', 'host',
] as const;

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://app.e8productions.com';
const EMAIL_BATCH_SIZE = 40; // per cron tick (1/min) — well under Workers subrequest limits

const TYPE_LABEL: Record<string, string> = {
  NEW_FEATURE: 'New feature',
  UPDATE: 'Update',
  MAINTENANCE: 'Maintenance',
  IMPORTANT: 'Important',
};

type AnnouncementRow = typeof announcement.$inferSelect;

const nowIso = () => new Date().toISOString();
const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---------------------------------------------------------------------------
// Audience
// ---------------------------------------------------------------------------

/** Condition matching users who belong to the announcement's audience. */
function audienceCondition(a: Pick<AnnouncementRow, 'audienceAll' | 'audienceRoles' | 'audienceUserIds'>) {
  const active = or(isNull(userTable.employeeStatus), eq(userTable.employeeStatus, 'ACTIVE'));
  if (a.audienceAll) return active;
  const parts: any[] = [];
  if (a.audienceRoles.length) {
    parts.push(inArray(userTable.role, a.audienceRoles as any));
    parts.push(arrayOverlaps(userTable.roles, a.audienceRoles as any));
  }
  if (a.audienceUserIds.length) parts.push(inArray(userTable.id, a.audienceUserIds));
  if (!parts.length) return sql`false`;
  return and(active, or(...parts));
}

export async function countAudience(a: Pick<AnnouncementRow, 'audienceAll' | 'audienceRoles' | 'audienceUserIds'>) {
  const db = getDbHttp();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(userTable)
    .where(audienceCondition(a));
  return row?.n ?? 0;
}

// ---------------------------------------------------------------------------
// Publish
// ---------------------------------------------------------------------------

/**
 * Publishes a DRAFT/SCHEDULED announcement. The status flip is a single
 * conditional UPDATE, so two racing callers (admin click + cron) can't both
 * publish it. Returns the published row, or null if someone else already did.
 */
export async function publishAnnouncement(id: string): Promise<AnnouncementRow | null> {
  const db = getDbHttp();
  const [existing] = await db.select().from(announcement).where(eq(announcement.id, id)).limit(1);
  if (!existing) return null;

  const recipientCount = await countAudience(existing);
  const now = nowIso();

  const [published] = await db
    .update(announcement)
    .set({
      status: 'PUBLISHED',
      publishedAt: now,
      recipientCount,
      emailSentCount: 0,
      updatedAt: now,
    })
    .where(and(eq(announcement.id, id), ne(announcement.status, 'PUBLISHED')))
    .returning();

  if (!published) return null;

  if (published.sendSlack) {
    try {
      await postToSlack(published);
    } catch (err: any) {
      console.warn('[announcements] Slack post failed:', err?.message);
    }
  }
  return published;
}

/** Cron hook: publish every SCHEDULED announcement that is due. */
export async function publishDueAnnouncements(): Promise<number> {
  const db = getDbHttp();
  const due = await db
    .select({ id: announcement.id })
    .from(announcement)
    .where(and(eq(announcement.status, 'SCHEDULED'), lte(announcement.publishAt, nowIso())))
    .limit(20);
  let n = 0;
  for (const d of due) {
    const res = await publishAnnouncement(d.id);
    if (res) n++;
  }
  return n;
}

// ---------------------------------------------------------------------------
// Slack
// ---------------------------------------------------------------------------

async function postToSlack(a: AnnouncementRow) {
  // Channels the admin picked; if none (older rows) fall back to editors/e8app by audience.
  const channels: SlackChannel[] = a.slackChannels.length
    ? (a.slackChannels as SlackChannel[])
    : [a.audienceRoles.includes('editor') && !a.audienceAll ? 'editors' : 'e8app'];
  const link = a.linkUrl ? `\n<${absoluteUrl(a.linkUrl)}|${a.linkLabel || 'Learn more'}>` : '';
  for (const channel of channels) {
    await sendToChannel(channel, {
      type: 'announcement',
      title: a.title,
      message: `📣 *${TYPE_LABEL[a.type] || 'Announcement'}: ${a.title}*\n${a.body}${link}`,
    });
  }
}

// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------

function absoluteUrl(url: string) {
  return /^https?:\/\//i.test(url) ? url : `${BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

export function renderAnnouncementEmail(a: Pick<AnnouncementRow, 'title' | 'body' | 'type' | 'linkUrl' | 'linkLabel'>) {
  const bodyHtml = esc(a.body).replace(/\n/g, '<br>');
  const button = a.linkUrl
    ? `<tr><td class="px" style="padding:8px 40px 0 40px;">
        <a href="${esc(absoluteUrl(a.linkUrl))}" style="display:inline-block;background:#0a0a0b;color:#ffffff;text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:bold;padding:12px 22px;border-radius:8px;">${esc(a.linkLabel || 'Learn more')}</a>
      </td></tr>`
    : '';
  return renderEmailShell({
    previewText: esc(a.title),
    contentHtml: `
      <tr><td class="px" style="padding:28px 40px 4px 40px;font-family:Helvetica,Arial,sans-serif;font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#8a8a91;">${esc(TYPE_LABEL[a.type] || 'Announcement')}</td></tr>
      <tr><td class="px" style="padding:0 40px 12px 40px;font-family:Helvetica,Arial,sans-serif;font-size:22px;font-weight:bold;line-height:1.3;color:#0a0a0b;">${esc(a.title)}</td></tr>
      <tr><td class="px" style="padding:0 40px 16px 40px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#3f3f46;">${bodyHtml}</td></tr>
      ${button}`,
  });
}

/** Sends a one-off preview email of an announcement to a single address. */
export async function sendTestEmail(a: Pick<AnnouncementRow, 'title' | 'body' | 'type' | 'linkUrl' | 'linkLabel'>, to: string) {
  return sendRawEmail({
    to,
    subject: `[Test] ${a.title}`,
    html: renderAnnouncementEmail(a),
  });
}

/**
 * Cron hook: sends the next batch of emails for ONE published announcement that
 * still has emails outstanding. Respects each user's `emailNotifications`.
 * Returns how many emails were queued this tick.
 */
export async function sendEmailBatches(): Promise<number> {
  const db = getDbHttp();
  const [a] = await db
    .select()
    .from(announcement)
    .where(
      and(
        eq(announcement.status, 'PUBLISHED'),
        eq(announcement.sendEmail, true),
        sql`${announcement.emailSentCount} < ${announcement.recipientCount}`,
      ),
    )
    .orderBy(asc(announcement.publishedAt))
    .limit(1);
  if (!a) return 0;

  const batch = await db
    .select({ id: userTable.id, email: userTable.email, emailNotifications: userTable.emailNotifications })
    .from(userTable)
    .where(audienceCondition(a))
    .orderBy(asc(userTable.id))
    .limit(EMAIL_BATCH_SIZE)
    .offset(a.emailSentCount);

  // Advance the cursor FIRST so a crash mid-batch can't make the next tick
  // re-send the same people (a skipped email beats a duplicate blast).
  const advance = batch.length || a.recipientCount - a.emailSentCount; // empty batch => audience shrank, finish
  await db
    .update(announcement)
    .set({ emailSentCount: a.emailSentCount + advance, updatedAt: nowIso() })
    .where(and(eq(announcement.id, a.id), eq(announcement.emailSentCount, a.emailSentCount)));

  const html = renderAnnouncementEmail(a);
  let sent = 0;
  for (const u of batch) {
    if (!u.emailNotifications || !u.email) continue;
    try {
      await sendRawEmail({ to: u.email, subject: a.title, html });
      sent++;
    } catch (err: any) {
      console.warn(`[announcements] email to user ${u.id} failed:`, err?.message);
    }
  }
  return sent;
}

// ---------------------------------------------------------------------------
// Viewer feed
// ---------------------------------------------------------------------------

export interface FeedItem {
  id: string;
  title: string;
  body: string;
  type: string;
  linkUrl: string | null;
  linkLabel: string | null;
  showPopup: boolean;
  publishedAt: string | null;
  read: boolean;
  dismissed: boolean;
}

/** Published, unexpired announcements aimed at this viewer, newest first. */
export async function getFeedForUser(userId: number, roles: string[], limit = 30): Promise<FeedItem[]> {
  const db = getDbHttp();
  const now = nowIso();
  const lowerRoles = roles.map((r) => r.toLowerCase());

  const audience = or(
    eq(announcement.audienceAll, true),
    lowerRoles.length ? arrayOverlaps(announcement.audienceRoles, lowerRoles) : sql`false`,
    arrayContains(announcement.audienceUserIds, [userId]),
  );

  const rows = await db
    .select({
      id: announcement.id,
      title: announcement.title,
      body: announcement.body,
      type: announcement.type,
      linkUrl: announcement.linkUrl,
      linkLabel: announcement.linkLabel,
      showPopup: announcement.showPopup,
      publishedAt: announcement.publishedAt,
      readAt: announcementRead.readAt,
      dismissedAt: announcementRead.dismissedAt,
    })
    .from(announcement)
    .leftJoin(
      announcementRead,
      and(eq(announcementRead.announcementId, announcement.id), eq(announcementRead.userId, userId)),
    )
    .where(
      and(
        eq(announcement.status, 'PUBLISHED'),
        or(isNull(announcement.expiresAt), gt(announcement.expiresAt, now)),
        audience,
      ),
    )
    .orderBy(desc(announcement.publishedAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    type: r.type,
    linkUrl: r.linkUrl,
    linkLabel: r.linkLabel,
    showPopup: r.showPopup,
    publishedAt: r.publishedAt,
    read: !!r.readAt,
    dismissed: !!r.dismissedAt,
  }));
}

/** Marks announcements read (and optionally dismissed) for a user. Idempotent. */
export async function markRead(userId: number, ids: string[], dismiss = false) {
  if (!ids.length) return;
  const db = getDbHttp();
  const now = nowIso();
  await db
    .insert(announcementRead)
    .values(
      ids.map((announcementId) => ({
        id: createId(),
        announcementId,
        userId,
        readAt: now,
        dismissedAt: dismiss ? now : null,
      })),
    )
    .onConflictDoUpdate({
      target: [announcementRead.announcementId, announcementRead.userId],
      set: dismiss ? { dismissedAt: now } : { readAt: sql`"AnnouncementRead"."readAt"` },
    });
}

/** Read / dismissed counts per announcement, for the admin history table. */
export async function getReadStats(ids: string[]) {
  if (!ids.length) return new Map<string, { read: number; dismissed: number }>();
  const db = getDbHttp();
  const rows = await db
    .select({
      id: announcementRead.announcementId,
      read: sql<number>`count(*)::int`,
      dismissed: sql<number>`count(${announcementRead.dismissedAt})::int`,
    })
    .from(announcementRead)
    .where(inArray(announcementRead.announcementId, ids))
    .groupBy(announcementRead.announcementId);
  return new Map(rows.map((r) => [r.id, { read: r.read, dismissed: r.dismissed }]));
}
