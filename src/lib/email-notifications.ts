
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
            include: { client: true }
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

        const dashboardUrl = "https://e8productions.com";

        const mailOptions = {
            from: `"E8 Productions" <i@needediting.com>`,
            to: clientEmails.join(', '),
            subject: `Ready for Review: ${task.title || 'Untitled Task'}`,
            html: `
        <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
          <h2 style="color: #0070f3;">Task Ready for Review</h2>
          <p>Hi ${task.client.name},</p>
          <p>Your task <strong>${task.title || 'Untitled Task'}</strong> is now ready for your review!</p>
          <p>Please log in to your dashboard to review the files and provide feedback.</p>
          <p><a href="${dashboardUrl}" style="color: #0070f3; text-decoration: none;">Go to Dashboard</a></p>
          <br />
          <p>Best regards,</p>
          <p><strong>E8 Productions Team</strong></p>
        </div>
      `,
        };

        await transporter.sendMail(addGlobalBcc(mailOptions));
        console.log(`✅ Task ready for review email sent to: ${clientEmails.join(', ')}`);
    } catch (error) {
        console.error('❌ Failed to send task ready for review email:', error);
    }
}
