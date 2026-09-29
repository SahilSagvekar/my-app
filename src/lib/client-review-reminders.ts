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
import { task as taskTable, client as clientTable, user as userTable, file as fileTable, mediaPreview } from '@/lib/db/schema';
import { and, eq, isNull, lte, or, asc, inArray } from 'drizzle-orm';
import { addSignedUrlsToFiles } from '@/lib/s3';
import { createTransporter } from '@/lib/mail-transport';
import { getAllClientEmails } from '@/lib/email-notifications';
import { getOrCreateReviewShareUrl } from '@/lib/share-review-link';

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
  // Extra fields so the Client Review screen can render QC-style cards.
  // Optional: the reminder cron builds TaskInReview objects without them.
  deliverableType?: string | null;
  taskCategory?: string | null;
  editorName?: string | null;
  thumbnails?: string[];
  latestVersion?: number;
  fileCount?: number;
}

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif)$/i;

/**
 * Card media for a set of tasks in one query: thumbnail URLs (same priority
 * as the QC card — editor thumbnails/tiles, then other images, then the
 * generated video preview), latest video version and file count. Only the
 * thumbnail files themselves get signed, not every file on the task.
 */
async function getCardMedia(taskIds: string[]) {
  const db = getDbHttp();
  const out = new Map<string, { thumbnails: string[]; latestVersion: number; fileCount: number }>();
  if (taskIds.length === 0) return out;

  const files: any[] = await db
    .select({
      id: fileTable.id,
      taskId: fileTable.taskId,
      name: fileTable.name,
      url: fileTable.url,
      s3Key: fileTable.s3Key,
      mimeType: fileTable.mimeType,
      folderType: fileTable.folderType,
      version: fileTable.version,
      isActive: fileTable.isActive,
      uploadedAt: fileTable.uploadedAt,
    })
    .from(fileTable)
    .where(inArray(fileTable.taskId, taskIds));

  const videoKeys = [...new Set(
    files.filter((f) => f.isActive !== false && f.mimeType?.startsWith('video/') && f.s3Key).map((f) => f.s3Key as string)
  )];
  const previewByKey = new Map<string, string>();
  if (videoKeys.length) {
    const previews = await db
      .select({ s3Key: mediaPreview.s3Key, previewS3Key: mediaPreview.previewS3Key })
      .from(mediaPreview)
      .where(and(inArray(mediaPreview.s3Key, videoKeys), eq(mediaPreview.status, 'READY')));
    for (const p of previews) {
      if (p.previewS3Key) previewByKey.set(p.s3Key, `/api/media-previews/image?key=${encodeURIComponent(p.previewS3Key)}`);
    }
  }

  const byTask = new Map<string, any[]>();
  for (const f of files) {
    if (!byTask.has(f.taskId)) byTask.set(f.taskId, []);
    byTask.get(f.taskId)!.push(f);
  }

  const newestFirst = (a: any, b: any) => {
    const v = (b.version || 1) - (a.version || 1);
    return v !== 0 ? v : new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime();
  };

  // Decide which files become thumbnails per task, then sign them all at once.
  const plan = new Map<string, { signFiles: any[]; previewUrls: string[] }>();
  for (const [taskId, tFiles] of byTask) {
    const active = tFiles.filter((f) => f.isActive !== false && !!f.url);
    const thumbFiles = active.filter((f) => f.folderType === 'thumbnails' || f.folderType === 'tiles').sort(newestFirst);
    let signFiles: any[] = [];
    let previewUrls: string[] = [];
    if (thumbFiles.length) {
      signFiles = thumbFiles;
    } else {
      const images = active
        .filter((f) => f.mimeType?.startsWith('image/') || f.folderType === 'covers' || (f.name && IMAGE_EXT.test(f.name)))
        .sort((a, b) => new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime());
      if (images.length) {
        signFiles = images;
      } else {
        const vid = active.find((f) => f.mimeType?.startsWith('video/') && f.s3Key && previewByKey.has(f.s3Key));
        if (vid) previewUrls = [previewByKey.get(vid.s3Key)!];
      }
    }
    plan.set(taskId, { signFiles: signFiles.slice(0, 6), previewUrls });
  }

  const allToSign = [...plan.values()].flatMap((p) => p.signFiles);
  const signed = await addSignedUrlsToFiles(allToSign);
  const signedById = new Map(signed.map((f: any) => [f.id, f.url as string]));

  for (const taskId of taskIds) {
    const tFiles = byTask.get(taskId) || [];
    const p = plan.get(taskId);
    const urls = [
      ...(p?.signFiles || []).map((f) => signedById.get(f.id) || f.url),
      ...(p?.previewUrls || []),
    ];
    const videos = tFiles.filter((f) => f.mimeType?.startsWith('video/'));
    const pool = videos.length ? videos : tFiles;
    const latestVersion = pool.reduce((m, f) => Math.max(m, f.version || 1), 1);
    const imageCount = tFiles.filter(
      (f) => f.mimeType?.startsWith('image/') || ['thumbnails', 'tiles', 'covers'].includes(f.folderType) || (f.name && IMAGE_EXT.test(f.name))
    ).length;
    out.set(taskId, {
      thumbnails: [...new Set(urls.filter(Boolean))],
      latestVersion,
      fileCount: imageCount || tFiles.length,
    });
  }
  return out;
}

function daysSince(iso: string | null): number {
  if (!iso) return 0;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

function baseUrl() {
  // Was defaulting to the marketing domain (e8productions.com), which
  // doesn't serve the app's /assets — that's what 404'd the logo. The app
  // itself, and the logo image, live on app.e8productions.com.
  return process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://app.e8productions.com';
}

// Base64 data: URIs get stripped/blocked as inline image src by Gmail and
// other major clients — that's why the logo was still broken after
// switching to one. A real HTTPS URL is the only reliable option; same
// fix as email-shell.ts, which every other email template uses.
const LOGO_URL = `${baseUrl()}/assets/e8-logo-black.png`;

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
      deliverableType: taskTable.deliverableType,
      taskCategory: taskTable.taskCategory,
      editorName: userTable.name,
    })
    .from(taskTable)
    .leftJoin(clientTable, eq(taskTable.clientId, clientTable.id))
    .leftJoin(userTable, eq(taskTable.assignedTo, userTable.id))
    .where(eq(taskTable.status, 'CLIENT_REVIEW'))
    .orderBy(asc(taskTable.clientReviewStartedAt));

  const media = await getCardMedia(rows.map((r) => r.id));

  // A direct, no-login review link per task — clicking it lands the client
  // straight on the review screen (just typing their name) instead of
  // forcing a sign-in. See /shared/review/[shareToken].
  return Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      title: r.title,
      clientId: r.clientId,
      clientName: r.clientName || 'Unknown Client',
      daysInReview: daysSince(r.clientReviewStartedAt),
      clientReviewStartedAt: r.clientReviewStartedAt,
      lastReminderSentAt: r.lastReminderSentAt,
      reviewUrl: await getOrCreateReviewShareUrl(r.id),
      dueDate: r.dueDate,
      deliverableType: r.deliverableType,
      taskCategory: r.taskCategory,
      editorName: r.editorName,
      thumbnails: media.get(r.id)?.thumbnails ?? [],
      latestVersion: media.get(r.id)?.latestVersion ?? 1,
      fileCount: media.get(r.id)?.fileCount ?? 0,
    }))
  );
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
      // A direct, no-login review link — see getTasksInReview() above.
      reviewUrl: await getOrCreateReviewShareUrl(r.id),
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
            <td style="padding:10px 14px;border-top:1px solid #e7e7e9;font-family:Helvetica,Arial,sans-serif;font-size:13px;font-weight:bold;">
              <a href="${t.reviewUrl}" style="color:#0a0a0b;text-decoration:none;">${t.title || 'Untitled Task'} &rarr;</a>
            </td>
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
          <td style="width:27px;vertical-align:middle;"><img src="${LOGO_URL}" width="27" height="36" alt="E8" style="display:block;width:27px;height:36px;"></td>
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
          <a href="${tasks[0].reviewUrl}" style="display:block;padding:12px 24px;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;letter-spacing:0.2px;border-radius:8px;">${isSingle ? 'Review Now' : `Review "${tasks[0].title || 'Untitled Task'}"`}</a>
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