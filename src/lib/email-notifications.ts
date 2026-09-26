import { getDbHttp } from './db';
import { client as clientTable, task as taskTable } from './db/schema';
import { eq } from 'drizzle-orm';
// Routes through the notifications queue — see src/lib/mail-transport.ts
// and src/lib/email.ts for the full explanation.
import { createTransporter } from '@/lib/mail-transport';
import { getOrCreateReviewShareUrl } from '@/lib/share-review-link';

// 🔥 Global BCC - All emails will be copied to these addresses for monitoring
const GLOBAL_BCC_EMAILS = ['sahilsagvekar230@gmail.com', 'eric@e8productions.com'];

const transporter = createTransporter();

// Helper function to add global BCC to mail options
const addGlobalBcc = (mailOptions: any) => {
    if (mailOptions.bcc) {
        mailOptions.bcc = Array.isArray(mailOptions.bcc)
            ? [...mailOptions.bcc, ...GLOBAL_BCC_EMAILS]
            : [mailOptions.bcc, ...GLOBAL_BCC_EMAILS];
    } else {
        mailOptions.bcc = GLOBAL_BCC_EMAILS;
    }
    return mailOptions;
};

/**
 * Helper to get all relevant client emails from various possible sources
 */
export async function getAllClientEmails(clientId: string): Promise<string[]> {
  const db = getDbHttp();
    const client = await db.query.client.findFirst({
        where: eq(clientTable.id, clientId),
        with: {
            user: {
                columns: {
                    email: true,
                    emailNotifications: true,
                },
            },
            // "linkedUsers" in the old Prisma schema — users linked via User.linkedClientId
            users: {
                columns: {
                    email: true,
                    emailNotifications: true,
                },
            },
        },
    });

    if (!client) {
        console.log(`[EmailNotification] Client ${clientId} not found.`);
        return [];
    }

    const emailSet = new Set<string>();
    const blockedEmails = new Set<string>();

    // 1. Identify blocked emails from ALL associated users
    const allAssociatedUsers = [
        ...(client.user ? [client.user] : []),
        ...(client.users || [])
    ];

    allAssociatedUsers.forEach(u => {
        if (u.emailNotifications === false && u.email) {
            const blocked = u.email.trim().toLowerCase();
            blockedEmails.add(blocked);
            console.log(`[EmailNotification] User ${blocked} has OPTED OUT.`);
        }
    });

    // 2. Add Primary email on Client record (if not blocked)
    if (client.email) {
        const primary = client.email.trim();
        if (!blockedEmails.has(primary.toLowerCase())) {
            emailSet.add(primary);
        } else {
            console.log(`[EmailNotification] Blocked company primary email: ${primary}`);
        }
    }

    // 3. Add Additional emails array on Client record (if not blocked)
    if (client.emails && Array.isArray(client.emails)) {
        client.emails.forEach(e => {
            if (e && e.trim()) {
                const email = e.trim();
                if (!blockedEmails.has(email.toLowerCase())) {
                    emailSet.add(email);
                } else {
                    console.log(`[EmailNotification] Blocked company additional email: ${email}`);
                }
            }
        });
    }

    // 4. Add User emails who have notifications enabled
    allAssociatedUsers.forEach(u => {
        if (u.email && u.email.trim() && u.emailNotifications !== false) {
            emailSet.add(u.email.trim());
        }
    });

    const finalEscapedEmails = Array.from(emailSet);
    console.log(`[EmailNotification] Final recipient list for ${client.name}:`, finalEscapedEmails);

    return finalEscapedEmails;
}


/**
 * Send email when a task is ready for client review
 * @param triggeredByUserId the staff member whose action put it in review
 *   (QC/admin/scheduler) — purely an attribution field on the generated
 *   share link, no functional effect if omitted.
 */
export async function sendTaskReadyForReviewEmail(taskId: string, triggeredByUserId?: number) {
  const db = getDbHttp();
    try {
        const task = await db.query.task.findFirst({
            where: eq(taskTable.id, taskId),
            with: {
                client: true,
                monthlyDeliverable: { columns: { type: true } },
                oneOffDeliverable: { columns: { type: true } },
            },
        });

        console.log(`Task ID: ${taskId}`);

        if (!task || !task.client) {
            console.error(`[EmailNotification] Task or client not found for ID: ${taskId}`);
            return;
        }

        const clientEmails = await getAllClientEmails(task.client.id);
        if (clientEmails.length === 0) {
            console.log(`[EmailNotification] No emails found for client: ${task.client.name}`);
            return;
        }

        console.log(`[clientEmails]`, clientEmails);

        // Matches the app-URL convention used everywhere else in the codebase
        // (see assemblyai.ts, slack.ts, etc.) — this previously used a
        // `BASE_URL` env var nothing else sets, falling back to the marketing
        // site's domain (e8productions.com) instead of the app's
        // (app.e8productions.com), which is why the logo 404'd in this email.
        const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://app.e8productions.com';

        // A direct, no-login review link — clicking it in the email lands
        // the client straight on the review screen (just typing their name)
        // instead of forcing a sign-in first. See /shared/review/[shareToken].
        const dashboardUrl = await getOrCreateReviewShareUrl(taskId, triggeredByUserId);

        const LOGO_URL = `${BASE_URL}/assets/e8-logo-black.png`;


        const taskName = task.title || 'Untitled Task';
        const deliverableLabel = task.monthlyDeliverable?.type || task.oneOffDeliverable?.type || 'deliverable';

        // Client only has a single `name` field — split it for the greeting.
        // One email goes to the whole client contact list, so this greeting
        // is shared rather than personalized per-recipient.
        const nameParts = (task.client.name || '').trim().split(/\s+/);
        const recipientFirstName = nameParts[0] || 'there';
        const recipientLastName = nameParts.slice(1).join(' ');

        const footnote = 'This deliverable goes to our Scheduler for posting once approved.'; // optional extra note — leave blank to omit the paragraph

        const mailOptions = {
            from: `"E8 Productions" <i@needediting.com>`,
            to: clientEmails.join(', '),
            subject: `Your ${deliverableLabel} is ready for review`,
            html: `
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
  @media (max-width: 620px) {
    .container { width: 100% !important; }
    .px { padding-left: 24px !important; padding-right: 24px !important; }
  }
  table { border-collapse: collapse; }
</style>
</head>
<body style="margin:0;padding:0;">
<div style="background-color:#f4f4f5;margin:0;padding:0;font-family:Helvetica,Arial,sans-serif;">
  <span style="display:none;font-size:1px;color:#f4f4f5;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">Your ${deliverableLabel} is ready for review — ${taskName}.</span>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:#ffffff;border:1px solid #d3d3d6;border-radius:12px;box-shadow:0 2px 12px rgba(10,10,11,0.06);">

          <tr>
            <td class="px" style="padding: 20px 40px 16px 40px; width: 518px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="width:27px;vertical-align:middle;">
                    <img src="${LOGO_URL}" width="27" height="36" alt="E8" style="display:block;width:27px;height:36px;">
                  </td>
                  <td style="width:12px;">&nbsp;</td>
                  <td style="font-family: Helvetica,Arial,sans-serif; font-size: 25px; font-weight: bold; letter-spacing: 0.2px; color: #0a0a0b; vertical-align: middle; width: 94px; height: 58px">E8 App</td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td class="px" style="padding:0 40px;">
              <div style="border-top:1px solid #e7e7e9;font-size:0;line-height:0;">&nbsp;</div>
            </td>
          </tr>

          <tr>
            <td class="px" style="padding:32px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-weight:bold;font-size:22px;line-height:1.35;color:#0a0a0b;">
              Your ${deliverableLabel} is ready for review
            </td>
          </tr>

          <tr>
            <td class="px" style="padding:24px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#222225;">
              Hi ${recipientFirstName}${recipientLastName ? ' ' + recipientLastName : ''},
            </td>
          </tr>

          <tr>
            <td class="px" style="padding:14px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#222225;">
              <strong>${taskName}</strong> passed our Quality Control. The following deliverable(s) are up for review.</td>
          </tr>

          ${footnote ? `
          <tr>
            <td class="px" style="padding:14px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#6b6b72;">${footnote}</td>
          </tr>` : ''}

          <tr>
            <td class="px" style="padding:28px 40px 0 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background-color:#0a0a0b;text-align:center;border-radius:8px;" bgcolor="#0a0a0b">
                    <a href="${dashboardUrl}" style="display:block;padding:12px 24px;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;letter-spacing:0.2px;border-radius:8px;">Review Deliverable</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td class="px" style="padding:32px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:#6b6b72;">This is an automated notification from the E8 App. Replies to this address aren't always monitored.</td>
          </tr>

          <tr>
            <td class="px" style="padding:32px 40px 24px 40px;">
              <div style="border-top:1px solid #e7e7e9;font-size:0;line-height:0;">&nbsp;</div>
            </td>
          </tr>

          <tr>
            <td class="px" style="padding:0 40px 32px 40px;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#8a8a91;">
              E8 Productions, LLC &middot; e8productions.com
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</div>
</body>
</html>
      `,
        };

        await transporter.sendMail(addGlobalBcc(mailOptions));
        console.log(`✅ Task ready for review email sent to: ${clientEmails.join(', ')}`);
    } catch (error) {
        console.error('❌ Failed to send task ready for review email:', error);
    }
}