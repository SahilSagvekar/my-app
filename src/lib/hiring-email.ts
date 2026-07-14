// src/lib/hiring-email.ts
// Candidate-facing emails for the editor hiring pipeline. Uses the shared
// nodemailer transport (sendRawEmail) — same dev-mode console fallback when
// SMTP isn't configured, same global BCC monitoring.

import { sendRawEmail } from '@/lib/email';

function wrapper(bodyHtml: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #334155; background-color: #f1f5f9; margin: 0; padding: 0;">
        <div style="max-width: 600px; margin: 0 auto; padding: 30px 20px;">
          <div style="background: #000000; color: white; padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
            <h1 style="margin: 0; font-size: 20px; letter-spacing: 0.02em;">E8 PRODUCTIONS</h1>
          </div>
          <div style="background: #ffffff; padding: 32px 30px; border-radius: 0 0 16px 16px;">
            ${bodyHtml}
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
            <p style="font-size: 12px; color: #94a3b8; text-align: center;">© ${new Date().getFullYear()} E8 Productions</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

export async function sendTestTaskInviteEmail(data: {
  candidateName: string;
  candidateEmail: string;
  taskTitle: string;
  instructions: string;
  rawFootageUrl?: string | null;
  submissionUrl: string;
}) {
  const html = wrapper(`
    <p>Hi ${data.candidateName},</p>
    <p>Thanks for your interest in editing with E8 Productions. Before we move forward, we'd like you to complete a short paid-attention test task so we can see your editing style firsthand.</p>
    <div style="background: #f8fafc; border-left: 4px solid #000000; padding: 16px 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
      <h3 style="margin: 0 0 8px 0; color: #1e293b;">${data.taskTitle}</h3>
      <p style="margin: 0; font-size: 14px; color: #475569; white-space: pre-wrap;">${data.instructions}</p>
      ${data.rawFootageUrl ? `<p style="margin: 12px 0 0; font-size: 14px;"><strong>Raw footage:</strong> <a href="${data.rawFootageUrl}" style="color: #2563eb;">${data.rawFootageUrl}</a></p>` : ''}
    </div>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${data.submissionUrl}" style="display: inline-block; padding: 16px 40px; background: #000000; color: white; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 16px;">Submit Your Edit</a>
    </div>
    <p style="font-size: 13px; color: #94a3b8; text-align: center;">Or copy this link: <a href="${data.submissionUrl}" style="color: #2563eb; word-break: break-all;">${data.submissionUrl}</a></p>
    <p>No account needed — just paste a link to your finished edit (Drive, YouTube, WeTransfer, etc.) or upload it directly from that page.</p>
  `);

  return sendRawEmail({
    to: data.candidateEmail,
    subject: `Editing Test Task — ${data.taskTitle}`,
    html,
  });
}

export async function sendTestTaskDecisionEmail(data: {
  candidateName: string;
  candidateEmail: string;
  taskTitle: string;
  decision: 'APPROVED' | 'REJECTED';
  reviewNotes?: string | null;
}) {
  const isApproved = data.decision === 'APPROVED';
  const html = wrapper(`
    <p>Hi ${data.candidateName},</p>
    ${isApproved
      ? `<p>Great news — your test edit for <strong>${data.taskTitle}</strong> impressed our team. We'd love to talk next steps and get you onboarded.</p>`
      : `<p>Thanks for taking the time to complete the test edit for <strong>${data.taskTitle}</strong>. After review, we've decided not to move forward at this time.</p>`
    }
    ${data.reviewNotes ? `
      <div style="background: #f8fafc; border-left: 4px solid ${isApproved ? '#16a34a' : '#64748b'}; padding: 16px 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
        <p style="margin: 0; font-size: 14px; color: #475569; white-space: pre-wrap;">${data.reviewNotes}</p>
      </div>
    ` : ''}
    <p>${isApproved ? "Someone from our team will be in touch shortly." : "We'll keep your info on file and may reach out for future opportunities."}</p>
  `);

  return sendRawEmail({
    to: data.candidateEmail,
    subject: isApproved
      ? `You're moving forward — ${data.taskTitle}`
      : `Update on your test task — ${data.taskTitle}`,
    html,
  });
}
