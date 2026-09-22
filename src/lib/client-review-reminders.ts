// src/lib/client-review-reminders.ts
//
// Client Review Status & Reminder System.
//
// - getTasksInReview(): powers the scheduler/QC "Client Review" panels.
// - getTasksNeedingAutoReminder(): the 5-day-threshold / 3-day-cooldown
//   query used by the daily cron (src/app/api/cron/client-review-reminders).
// - sendReviewReminder(): the actual email — shared by both the manual
//   "Send Reminder" button (single task) and the automated rule (which may
//   bundle several overdue tasks for the same client into one email).

import { getDbHttp } from '@/lib/db';
import { task as taskTable, client as clientTable } from '@/lib/db/schema';
import { and, eq, isNull, lte, or, asc } from 'drizzle-orm';
import { createTransporter } from '@/lib/mail-transport';
import { getAllClientEmails } from '@/lib/email-notifications';

const GLOBAL_BCC_EMAILS = ['sahilsagvekar230@gmail.com', 'eric@e8productions.com'];
const AUTO_REMINDER_THRESHOLD_DAYS = 5;
const AUTO_REMINDER_COOLDOWN_DAYS = 3;

function addGlobalBcc(mailOptions: any) {
  mailOptions.bcc = Array.isArray(mailOptions.bcc)
    ? [...mailOptions.bcc, ...GLOBAL_BCC_EMAILS]
    : mailOptions.bcc
    ? [mailOptions.bcc, ...GLOBAL_BCC_EMAILS]
    : GLOBAL_BCC_EMAILS;
  return mailOptions;
}

export interface TaskInReview {
  id: string;
  title: string | null;
  clientId: string | null;
  clientName: string;
  daysInReview: number;
  clientReviewStartedAt: string | null;
  lastReminderSentAt: string | null;
  reviewUrl: string;
  dueDate: string | null;
}

function daysSince(iso: string | null): number {
  if (!iso) return 0;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

function baseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || process.env.BASE_URL || 'https://e8productions.com';
}

/**
 * Tasks currently sitting in CLIENT_REVIEW, oldest first — powers both the
 * scheduler and QC "Client Review" panels. `scope` is accepted for future
 * per-person filtering but both roles currently see the same company-wide
 * list (per the feature spec).
 */
export async function getTasksInReview(): Promise<TaskInReview[]> {
  const db = getDbHttp();

  const rows = await db
    .select({
      id: taskTable.id,
      title: taskTable.title,
      clientId: taskTable.clientId,
      clientName: clientTable.name,
      clientReviewStartedAt: taskTable.clientReviewStartedAt,
      lastReminderSentAt: taskTable.lastReminderSentAt,
      dueDate: taskTable.dueDate,
    })
    .from(taskTable)
    .leftJoin(clientTable, eq(taskTable.clientId, clientTable.id))
    .where(eq(taskTable.status, 'CLIENT_REVIEW'))
    .orderBy(asc(taskTable.clientReviewStartedAt));

  const url = baseUrl();
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    clientId: r.clientId,
    clientName: r.clientName || 'Unknown Client',
    daysInReview: daysSince(r.clientReviewStartedAt),
    clientReviewStartedAt: r.clientReviewStartedAt,
    lastReminderSentAt: r.lastReminderSentAt,
    reviewUrl: `${url}/dashboard`,
    dueDate: r.dueDate,
  }));
}

/**
 * Tasks eligible for an automated reminder right now: in CLIENT_REVIEW,
 * past the 5-day threshold, and either never reminded or outside the 3-day
 * cooldown. Grouped by client so the cron can send one combined email per
 * client rather than one email per task.
 */
export async function getTasksNeedingAutoReminder(): Promise<Map<string, TaskInReview[]>> {
  const db = getDbHttp();

  const thresholdCutoff = new Date(Date.now() - AUTO_REMINDER_THRESHOLD_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const cooldownCutoff = new Date(Date.now() - AUTO_REMINDER_COOLDOWN_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const rows = await db
    .select({
      id: taskTable.id,
      title: taskTable.title,
      clientId: taskTable.clientId,
      clientName: clientTable.name,
      clientReviewStartedAt: taskTable.clientReviewStartedAt,
      lastReminderSentAt: taskTable.lastReminderSentAt,
      dueDate: taskTable.dueDate,
    })
    .from(taskTable)
    .leftJoin(clientTable, eq(taskTable.clientId, clientTable.id))
    .where(
      and(
        eq(taskTable.status, 'CLIENT_REVIEW'),
        lte(taskTable.clientReviewStartedAt, thresholdCutoff),
        or(isNull(taskTable.lastReminderSentAt), lte(taskTable.lastReminderSentAt, cooldownCutoff))
      )
    );

  const url = baseUrl();
  const byClient = new Map<string, TaskInReview[]>();
  for (const r of rows) {
    if (!r.clientId) continue; // can't email a reminder with no client to resolve emails from
    const entry: TaskInReview = {
      id: r.id,
      title: r.title,
      clientId: r.clientId,
      clientName: r.clientName || 'Unknown Client',
      daysInReview: daysSince(r.clientReviewStartedAt),
      clientReviewStartedAt: r.clientReviewStartedAt,
      lastReminderSentAt: r.lastReminderSentAt,
      reviewUrl: `${url}/dashboard`,
      dueDate: r.dueDate,
    };
    const list = byClient.get(r.clientId) || [];
    list.push(entry);
    byClient.set(r.clientId, list);
  }
  return byClient;
}

function buildReminderEmailHtml(clientName: string, tasks: TaskInReview[]): { subject: string; html: string } {
  const isSingle = tasks.length === 1;
  const subject = isSingle
    ? `Reminder: "${tasks[0].title || 'Your video'}" is waiting on your review`
    : `Reminder: ${tasks.length} videos are waiting on your review`;

  const rows = tasks
    .map((t) => {
      const deadlineText = t.dueDate
        ? `Due ${new Date(t.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
        : '—';
      return `
          <tr>
            <td style="padding:10px 14px;border-top:1px solid #e7e7e9;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#0a0a0b;font-weight:bold;">${t.title || 'Untitled Task'}</td>
            <td style="padding:10px 14px;border-top:1px solid #e7e7e9;text-align:center;font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#222225;">${t.daysInReview} day${t.daysInReview === 1 ? '' : 's'}</td>
            <td style="padding:10px 14px;border-top:1px solid #e7e7e9;text-align:center;font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#6b6b72;">${deadlineText}</td>
          </tr>`;
    })
    .join('');

  const introText = isSingle
    ? `Your video <strong>"${tasks[0].title || 'Untitled Task'}"</strong> has been sitting in review for <strong>${tasks[0].daysInReview} days</strong> — it's ready whenever you are.`
    : `The following <strong>${tasks.length} videos</strong> for <strong>${clientName}</strong> have been waiting on your review. Taking a look keeps things moving on our end.`;

  const html = `
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light dark">
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<![endif]-->
<style>
body { margin: 0; padding: 0; }
  @media (max-width: 620px) { .container { width: 100% !important; } .px { padding-left: 24px !important; padding-right: 24px !important; } }
  table { border-collapse: collapse; }
</style>
</head>
<body style="margin:0;padding:0;">
<div style="background-color:#f4f4f5;margin:0;padding:0;font-family:Helvetica,Arial,sans-serif;">
  <span style="display:none;font-size:1px;color:#f4f4f5;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">Your video is ready for review.</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:40px 16px;">
    <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:#ffffff;border:1px solid #d3d3d6;border-radius:12px;box-shadow:0 2px 12px rgba(10,10,11,0.06);">
      <tr><td class="px" style="padding:20px 40px 16px 40px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="width:27px;vertical-align:middle;"><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEgAAABgCAYAAAC+EjQcAAAE4ElEQVR4AeycXZqqMAyGUy7VPR1nZejKxtkT9tKefpRgQTAKFRDSZ2KR0DZ5ScrP4zSjkeVwOBx3u8Npv9//sux2ezeXwAbYA4FtI92jQYAwMAyAMbeb+yVyuXN0ZBlr1Jj2sIHI5eQFtoUTdTgN7fMtQADThtI1sDF0mVJILC4fCuplQIgYnBHnIyW2ByCyzPywWHs11+v1Z0ohMmd6qbwPSgTEUYOQjW0wPkoABSCKoriwxMcsd9vlyAT4Jtn4FBA6aEcNwHCUAIo0wFL1yAT4Bh+f2dgLiFOKGwMMRwzvW0MNSPC1z5dOQKGBy7kR4HAq8b511S7vi6QHQOHAOxzyEyDg0MoLIin43nT0AZBzTTjWFoPvIZpDLf9b0/dgbwMQUstFl/EtwQEO+A4G2GZpACJ/91kr/L0Nb2+rbs5HNaAmOXP+5kv42BMap1oJKExOLueOt5Za7DfXzk8zgQmFh9XbjY5UF/P8tr0+bhsbZQRRNPdsPXr4tHOaZRxKUBj/fIVaxYdMlWZZnF7Omb8xcAAbD4Hh1cJ0L828O/kYu/vagk2VYuGQLKMLDSy4CuJu1HnyA7tYXDNj3L8MH2zZ0Es7IoeieQz9GZ+uUwrG/IRkKc44QpGNAxQ7w0szjEn+uZESl0aKDe/b5dx2zgdbm/i50fnpogaEM89Oan0nUAO679KtmIACiml0bCugDijxLgUU0+jYVkAdUOJdUwCKx/u6bQUknDIFpIAEAoJaI0gBCQQEtUaQAhIICGqNIAUkEBDUySNo6hf27fEEf99WJwf0tgULb6CAhBOUBJD1L+lTiWDv5OokgJJbvaAOFZBwMhSQAhIICGqNIAUkEBDUGkEKSCAgqDWCFJBAQFBrBCkggYCg1giaAlD7pdWY74K9k6vXEkEfA5ccEH7KN6ekJpUcEH7EOacsHlBqA+fuL3kEze1Q6vEVkEBUASkggYCg1ghSQAIBQa0RpIAEAoJaI0gBCQQE9XYjSADDagXEJHpqBdQDhncrICbRUycBhBdk3H/4F3H+9v11DQj/4ZvCHV7zIkVf7/aBxQ3ebSMdn6U4+8aYesUYgMZLeyxRMaVgTGotbiA5L+mNoUsdQdLBz/RhxQZTQ8KxADWlYMzU4pz58xF0d2xMelhbnKy9GvrA6gc0Y0kSQbH9tgJlPayphD50UrDYSxbSg8riHB3XdhUqHRv4ATZlBBk/GXEfY9KM+1hHbco5tQIUvsAxjSJQILJ+qsBWCQihZDSKwKMSU0YPvpSAsGFa9zJbnoswOYMJpAZUFMWFoqvBduei5iKbNSDyBXlnqlTDXIQ7Yb97M3/wHQxihxuAoDCtVPvE8w3GWaLEvrN9D4AwYWeNhW7D+u/cYK01fIbvbf8eAOGAcKCpZ3KkGx4G1ztxN+cdMGDpBARlyMU7JOzDOolrSzlETvAVHj5KLyAciobWP1OZauLGPrxSQDQB1DdHFHwCnJAtwbOuz6eAuAF+MUbRLQCVxeUhorAk6eEEWJBStfgPc4ZPEhy48RIgHGj9rbf10UQPoMiXAOsObO9wizCVxKuJemN6/zhqrPel96CW4mVA3A6d2woUBuT97RoT+5TSHp+/BxvNGen0atRwW9RvA0IjiPVnAQPaChb5yIIxEJqpYGwWAIEEG4vTK+nUZfZ/AAAA//9KLssaAAAABklEQVQDAELh2umNXjYGAAAAAElFTkSuQmCC" width="27" height="36" alt="E8" style="display:block;width:27px;height:36px;"></td>
          <td style="width:12px;">&nbsp;</td>
          <td style="font-family:Helvetica,Arial,sans-serif;font-size:25px;font-weight:bold;letter-spacing:0.2px;color:#0a0a0b;vertical-align:middle;">E8 App</td>
        </tr></table>
      </td></tr>
      <tr><td class="px" style="padding:0 40px;"><div style="border-top:1px solid #e7e7e9;font-size:0;line-height:0;">&nbsp;</div></td></tr>
      <tr><td class="px" style="padding:32px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-weight:bold;font-size:22px;line-height:1.35;color:#0a0a0b;">Waiting on your review</td></tr>
      <tr><td class="px" style="padding:20px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#222225;">${introText}</td></tr>
      ${!isSingle ? `
      <tr><td class="px" style="padding:20px 40px 0 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e7e7e9;border-radius:8px;overflow:hidden;">
          <tr style="background-color:#f4f4f5;"><td style="padding:9px 14px;font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#8a8a91;text-transform:uppercase;">Video</td><td style="padding:9px 14px;text-align:center;font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#8a8a91;text-transform:uppercase;">Waiting</td><td style="padding:9px 14px;text-align:center;font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#8a8a91;text-transform:uppercase;">Deadline</td></tr>
          ${rows}
        </table>
      </td></tr>` : ''}
      <tr><td class="px" style="padding:24px 40px 0 40px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td style="background-color:#0a0a0b;text-align:center;border-radius:8px;" bgcolor="#0a0a0b">
          <a href="${tasks[0].reviewUrl}" style="display:block;padding:12px 24px;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;letter-spacing:0.2px;border-radius:8px;">${isSingle ? 'Review Now' : 'Go to Dashboard'}</a>
        </td></tr></table>
      </td></tr>
      <tr><td class="px" style="padding:20px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:#6b6b72;">If you've already submitted feedback, please disregard this message.</td></tr>
      <tr><td class="px" style="padding:32px 40px 24px 40px;"><div style="border-top:1px solid #e7e7e9;font-size:0;line-height:0;">&nbsp;</div></td></tr>
      <tr><td class="px" style="padding:0 40px 32px 40px;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#8a8a91;">E8 Productions, LLC &middot; e8productions.com</td></tr>
    </table>
  </td></tr></table>
</div>
</body>
</html>
  `;

  return { subject, html };
}

export interface SendReminderResult {
  success: boolean;
  sentTo: string[];
  error?: string;
}

/**
 * Sends one reminder email for a set of tasks belonging to the same
 * client, then stamps lastReminderSentAt on every included task. Used by
 * both the manual "Send Reminder" button (single task) and the automated
 * cron rule (which may pass several overdue tasks for the same client).
 */
export async function sendReviewReminder(tasks: TaskInReview[]): Promise<SendReminderResult> {
  if (tasks.length === 0) return { success: false, sentTo: [], error: 'No tasks provided' };

  const clientId = tasks[0].clientId;
  const clientName = tasks[0].clientName;
  if (!clientId) return { success: false, sentTo: [], error: 'Task has no associated client' };

  const db = getDbHttp();
  const clientEmails = await getAllClientEmails(clientId);
  if (clientEmails.length === 0) {
    return { success: false, sentTo: [], error: 'No email-notifiable contacts for this client' };
  }

  const transporter = createTransporter();
  if (!transporter) {
    console.log(`[ClientReviewReminder] Email not configured — would have sent to: ${clientEmails.join(', ')}`);
    return { success: false, sentTo: [], error: 'Email not configured' };
  }

  const { subject, html } = buildReminderEmailHtml(clientName, tasks);

  const sentTo: string[] = [];
  for (const recipient of clientEmails) {
    try {
      await transporter.sendMail(
        addGlobalBcc({
          from: `"E8 Productions" <${process.env.SMTP_USER}>`,
          to: recipient,
          subject,
          html,
        })
      );
      sentTo.push(recipient);
      console.log(`✅ [ClientReviewReminder] Sent to ${recipient} for ${tasks.length} task(s)`);
    } catch (err) {
      console.error(`❌ [ClientReviewReminder] Failed to send to ${recipient}:`, err);
    }
  }

  if (sentTo.length === 0) {
    return { success: false, sentTo: [], error: 'All sends failed' };
  }

  const now = new Date().toISOString();
  for (const t of tasks) {
    await db.update(taskTable).set({ lastReminderSentAt: now }).where(eq(taskTable.id, t.id));
  }

  return { success: true, sentTo };
}