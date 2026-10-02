// src/lib/invite-email.ts
import { sendRawEmail } from "@/lib/email";
import { renderEmailShell } from "@/lib/email-shell";
import { INVITE_TTL_DAYS } from "@/lib/invites";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const roleLabel = (role: string) =>
  role === "qc"
    ? "Quality Control"
    : role
        .split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");

export async function sendInviteEmail(data: {
  email: string;
  name?: string | null;
  role: string;
  inviterName?: string | null;
  inviteUrl: string;
}) {
  const greeting = data.name ? `Hi ${esc(data.name)},` : "Hi,";
  const inviter = data.inviterName ? esc(data.inviterName) : "The E8 team";

  const contentHtml = `
      <tr><td class="px" style="padding:28px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:20px;font-weight:bold;color:#0a0a0b;">You're invited to E8 Productions</td></tr>
      <tr><td class="px" style="padding:16px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#3a3a40;">
        ${greeting}<br><br>
        ${inviter} has invited you to join the E8 App as <strong>${esc(roleLabel(data.role))}</strong>.
        Click the button below to register — you'll create your own password, and your portal will be set up as soon as you finish.
      </td></tr>
      <tr><td class="px" style="padding:24px 40px 0 40px;">
        <a href="${data.inviteUrl}" style="display:inline-block;background:#0a0a0b;color:#ffffff;text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:bold;padding:12px 22px;border-radius:8px;">Register now</a>
      </td></tr>
      <tr><td class="px" style="padding:20px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:#6b6b72;">
        This link is personal to you and expires in ${INVITE_TTL_DAYS} days. If the button doesn't work, paste this into your browser:<br>
        <span style="word-break:break-all;color:#0a0a0b;">${data.inviteUrl}</span>
      </td></tr>`;

  return sendRawEmail({
    to: data.email,
    subject: "You're invited to join E8 Productions",
    html: renderEmailShell({
      previewText: `${inviter} invited you to join the E8 App.`,
      contentHtml,
    }),
  });
}
