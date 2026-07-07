// src/lib/pipeline-notifications.ts
// Personal DM + email notifications for the quote/contract/onboarding pipeline.
// Recipients are a fixed list of people (Slack DMs only, no channel), configured via env vars.

import nodemailer from 'nodemailer';
import { sendSlackDM } from './slack';

function getSlackUserIds(): string[] {
  const raw = process.env.PIPELINE_NOTIFY_SLACK_USER_IDS;
  if (!raw) return ['U047GKLSCBD']; // fallback: Eric's Slack ID (already used elsewhere in the codebase)
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

function getNotifyEmails(): string[] {
  const raw = process.env.PIPELINE_NOTIFY_EMAILS;
  if (!raw) return ['eric@e8productions.com'];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

function getTransporter() {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function notify(type: string, title: string, body: string) {
  const slackUserIds = getSlackUserIds();
  await Promise.all(
    slackUserIds.map((id) =>
      sendSlackDM(id, { type, title, body }).catch((err) =>
        console.error(`[pipeline-notifications] Slack DM to ${id} failed:`, err)
      )
    )
  );

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return;
  const emails = getNotifyEmails();
  if (emails.length === 0) return;

  try {
    const transporter = getTransporter();
    await transporter.sendMail({
      from: `"E8 Productions" <${process.env.SMTP_USER}>`,
      to: emails.join(', '),
      subject: title,
      html: `<p>${body}</p>`,
    });
  } catch (err) {
    console.error('[pipeline-notifications] Email failed:', err);
  }
}

export async function notifyQuoteSent(clientName: string, amount: string) {
  await notify('quote_sent', `📤 Quote sent — ${clientName}`, `A quote for ${amount}/mo was sent to <strong>${clientName}</strong>.`);
}

export async function notifyQuoteAccepted(clientName: string, amount: string) {
  await notify('quote_accepted', `✅ Quote accepted — ${clientName}`, `<strong>${clientName}</strong> accepted their quote (${amount}/mo). Ready to provision.`);
}

export async function notifyQuoteRejected(clientName: string, reason?: string | null) {
  await notify(
    'quote_rejected',
    `❌ Quote rejected — ${clientName}`,
    `<strong>${clientName}</strong> rejected their quote.${reason ? ` Reason: ${reason}` : ''}`
  );
}

export async function notifyContractSent(title: string) {
  await notify('contract_sent', `📄 Contract sent`, `"${title}" was sent for signature.`);
}

export async function notifyContractSigned(title: string) {
  await notify('contract_signed', `✍️ Contract signed`, `"${title}" has been fully signed by all parties.`);
}

export async function notifyFirstPortalLogin(clientName: string) {
  await notify('first_portal_login', `👋 First portal login — ${clientName}`, `<strong>${clientName}</strong> logged into their client portal for the first time.`);
}
