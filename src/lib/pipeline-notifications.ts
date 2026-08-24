// src/lib/pipeline-notifications.ts
// Personal DM + email notifications for the quote/contract/onboarding pipeline.
// Recipients are a fixed list of people (Slack DMs only, no channel), configured via env vars.

import { createTransporter as getTransporter } from '@/lib/mail-transport';
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

async function notify(type: string, title: string, body: string) {
  const slackUserIds = getSlackUserIds();
  await Promise.all(
    slackUserIds.map((id) =>
      sendSlackDM(id, { type, title, body }).catch((err) =>
        console.error(`[pipeline-notifications] Slack DM to ${id} failed:`, err)
      )
    )
  );

  const emails = getNotifyEmails();
  if (emails.length === 0) return;

  try {
    const transporter = getTransporter();
    const isContract = type.startsWith('contract_');
    const footerNote = isContract
      ? 'E8 Productions Contract System &middot; sent to eric@e8productions.com'
      : 'E8 Productions — also sent as a Slack DM to the relevant team members.';
    await transporter.sendMail({
      from: `"E8 Productions" <${process.env.SMTP_USER}>`,
      to: emails.join(', '),
      subject: title,
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
  @media (max-width: 620px) { .container { width: 100% !important; } .px { padding-left: 24px !important; padding-right: 24px !important; } }
  table { border-collapse: collapse; }
</style>
</head>
<body style="margin:0;padding:0;">
<div style="background-color:#f4f4f5;margin:0;padding:0;font-family:Helvetica,Arial,sans-serif;">
  <span style="display:none;font-size:1px;color:#f4f4f5;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${isContract ? 'Contract activity from SignWell.' : 'Sales pipeline update.'}</span>
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
      <tr><td class="px" style="padding:32px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-weight:bold;font-size:22px;line-height:1.35;color:#0a0a0b;">${title}</td></tr>
      <tr><td class="px" style="padding:20px 40px 32px 40px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#222225;">${body}</td></tr>
      <tr><td class="px" style="padding:0 40px 32px 40px;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#8a8a91;border-top:1px solid #e7e7e9;padding-top:16px;">${footerNote}</td></tr>
    </table>
  </td></tr></table>
</div>
</body>
</html>
      `,
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
