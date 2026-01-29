
import nodemailer from 'nodemailer';
import { prisma } from './prisma';

// Use environment variables for SMTP
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
    },
});

/**
 * Helper to get all relevant client emails from various possible sources
 */
async function getAllClientEmails(clientId: string): Promise<string[]> {
    const client = await prisma.client.findUnique({
        where: { id: clientId },
        include: {
            linkedUsers: {
                select: { email: true }
            }
        }
    });

    console.log("client" + JSON.stringify(client))

    if (!client) return [];

    const emailSet = new Set<string>();

    // 1. Primary email on Client record
    if (client.email) emailSet.add(client.email.trim());

    // 2. Additional emails array on Client record
    if (client.emails && Array.isArray(client.emails)) {
        client.emails.forEach(e => {
            if (e && e.trim()) emailSet.add(e.trim());
        });
    }

    // 3. Linked User emails
    if (client.linkedUsers) {
        client.linkedUsers.forEach(u => {
            if (u.email && u.email.trim()) emailSet.add(u.email.trim());
        });
    }

    console.log("emailSet" + JSON.stringify(Array.from(emailSet)));

    return Array.from(emailSet);
}

/**
 * Send email when an editor starts a task
 */
export async function sendEditorStartedEmail(taskId: string, editorName: string) {
    try {
        const task = await prisma.task.findUnique({
            where: { id: taskId },
            include: { client: true }
        });

        if (!task || !task.client) {
            console.error(`[EmailNotification] Task or client not found for ID: ${taskId}`);
            return;
        }

        const clientEmails = await getAllClientEmails(task.client.id);
        if (clientEmails.length === 0) {
            console.log(`[EmailNotification] No emails found for client: ${task.client.name}`);
            return;
        }

        const mailOptions = {
            from: `"E8 Productions" <i@needediting.com>`,
            to: clientEmails.join(', '),
            subject: `Task Started: ${task.title || 'Untitled Task'}`,
            html: `
        <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
          <h2 style="color: #0070f3;">Project Update</h2>
          <p>Hi ${task.client.name},</p>
          <p>Good news! Our editor <strong>${editorName}</strong> has started working on your task: <strong>${task.title || 'Untitled Task'}</strong>.</p>
          <p>We will notify you once it's ready for your review.</p>
          <br />
          <p>Best regards,</p>
          <p><strong>E8 Productions Team</strong></p>
        </div>
      `,
        };

        await transporter.sendMail(mailOptions);
        console.log(`✅ Editor started email sent to: ${clientEmails.join(', ')}`);
    } catch (error) {
        console.error('❌ Failed to send editor started email:', error);
    }
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

        if (!task || !task.client) {
            console.error(`[EmailNotification] Task or client not found for ID: ${taskId}`);
            return;
        }

        const clientEmails = await getAllClientEmails(task.client.id);
        if (clientEmails.length === 0) {
            console.log(`[EmailNotification] No emails found for client: ${task.client.name}`);
            return;
        }

        const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://e8productions.com'}/client/dashboard`;

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
          <div style="margin: 30px 0;">
          </div>
          <br />
          <p>Best regards,</p>
          <p><strong>E8 Productions Team</strong></p>
        </div>
      `,
        };

        await transporter.sendMail(mailOptions);
        console.log(`✅ Task ready for review email sent to: ${clientEmails.join(', ')}`);
    } catch (error) {
        console.error('❌ Failed to send task ready for review email:', error);
    }
}
