import nodemailer from 'nodemailer';
import { prisma } from './prisma';

// Use environment variables for SMTP
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

// 🔥 Global BCC - All emails will be copied to these addresses for monitoring
const GLOBAL_BCC_EMAILS = ['sahilsagvekar230@gmail.com', 'eric@e8productions.com'];

const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
    },
});

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
async function getAllClientEmails(clientId: string): Promise<string[]> {
    const client = await prisma.client.findUnique({
        where: { id: clientId },
        include: {
            user: {
                select: {
                    email: true,
                    emailNotifications: true
                }
            },
            linkedUsers: {
                select: {
                    email: true,
                    emailNotifications: true
                }
            }
        }
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
        ...(client.linkedUsers || [])
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
 */
export async function sendTaskReadyForReviewEmail(taskId: string) {
    try {
        const task = await prisma.task.findUnique({
            where: { id: taskId },
            include: {
                client: true,
                monthlyDeliverable: { select: { type: true } },
                oneOffDeliverable: { select: { type: true } },
            }
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
        const dashboardUrl = BASE_URL;

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
        <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Ready for review</title>
        </head>
        <body style="margin: 0; padding: 0; background: #f3f4f6; font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6; padding: 40px 0;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb;">

                  <!-- Header -->
                  <tr>
                    <td style="padding: 32px 40px 24px;">
                      <table cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="padding-right: 10px;">
                            <img src="${LOGO_URL}" width="21" height="28" alt="" style="display:block;" />
                          </td>
                          <td>
                            <span style="font-size: 20px; font-weight: 700; color: #111827;">E8 App</span>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr><td style="border-top: 1px solid #e5e7eb;"></td></tr>

                  <!-- Body -->
                  <tr>
                    <td style="padding: 32px 40px 8px;">
                      <h1 style="margin: 0; font-size: 26px; line-height: 1.3; font-weight: 700; color: #111827;">
                        Your ${deliverableLabel} is ready for review
                      </h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 20px 40px 0; font-size: 15px; line-height: 1.6; color: #1a1a1a;">
                      Hi ${recipientFirstName}${recipientLastName ? ' ' + recipientLastName : ''},
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 40px 0; font-size: 15px; line-height: 1.6; color: #1a1a1a;">
                      <strong>${taskName}</strong> passed our Quality Control. The following deliverable(s) are up for review.
                    </td>
                  </tr>

                  ${footnote ? `
                  <tr>
                    <td style="padding: 20px 40px 0; font-size: 14px; line-height: 1.6; color: #6b7280;">
                      ${footnote}
                    </td>
                  </tr>` : ''}

                  <!-- Button -->
                  <tr>
                    <td style="padding: 28px 40px 8px;">
                      <a href="${dashboardUrl}"
                         style="display: inline-block; background: #111827; color: #ffffff; text-decoration: none;
                                font-size: 14px; font-weight: 600; padding: 12px 24px; border-radius: 6px;">
                        Review Deliverable
                      </a>
                    </td>
                  </tr>

                  <!-- Automated notice -->
                  <tr>
                    <td style="padding: 28px 40px 32px; font-size: 13px; line-height: 1.6; color: #6b7280;">
                      This is an automated notification from the E8 App. Replies to this address aren't always monitored.
                    </td>
                  </tr>

                  <tr><td style="border-top: 1px solid #e5e7eb;"></td></tr>

                  <!-- Footer -->
                  <tr>
                    <td style="padding: 20px 40px 28px; font-size: 12px; color: #9ca3af;">
                      E8 Productions, LLC &middot; e8productions.com
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
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