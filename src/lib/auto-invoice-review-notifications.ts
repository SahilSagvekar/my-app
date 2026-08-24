// Internal day-before review alerts for auto-invoice (Option 1).
// Does NOT block sending — only notifies so Eric/admins can edit settings first.

import { createTransporter as getTransporter } from '@/lib/mail-transport';
import { sendSlackDM, sendToChannel } from '@/lib/slack';
import { formatAmount } from '@/lib/stripe';

export type AutoInvoiceReviewItem = {
  clientId: string;
  clientName: string;
  email: string | null;
  amountCents: number;
  description: string;
  dueDays: number;
  nextBillingDate: string;
};

function getSlackUserIds(): string[] {
  const raw =
    process.env.AUTO_INVOICE_REVIEW_SLACK_USER_IDS ||
    process.env.PIPELINE_NOTIFY_SLACK_USER_IDS;
  if (!raw) return ['U047GKLSCBD']; // Eric
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

function getNotifyEmails(): string[] {
  const raw =
    process.env.AUTO_INVOICE_REVIEW_EMAILS ||
    process.env.PIPELINE_NOTIFY_EMAILS;
  if (!raw) return ['eric@e8productions.com', 'payments@e8productions.com'];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

function buildItemLines(items: AutoInvoiceReviewItem[]): string {
  return items
    .map((item) => {
      const amount = formatAmount(item.amountCents);
      const desc = item.description || 'Monthly retainer';
      return `• *${item.clientName}* — ${amount} — "${desc}" — due in ${item.dueDays} day(s) — ${item.email || 'no email'}`;
    })
    .join('\n');
}

function buildItemHtml(items: AutoInvoiceReviewItem[]): string {
  const rows = items
    .map((item) => {
      const amount = formatAmount(item.amountCents);
      const desc = item.description || 'Monthly retainer';
      return `<tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e7e7e9;font-size:13px;color:#0a0a0b;"><strong>${escapeHtml(item.clientName)}</strong></td>
        <td style="padding:10px 12px;border-bottom:1px solid #e7e7e9;font-size:13px;color:#0a0a0b;text-align:right;">${escapeHtml(amount)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e7e7e9;font-size:13px;color:#222225;">${escapeHtml(desc)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e7e7e9;font-size:13px;color:#6b6b72;">${item.dueDays}d</td>
      </tr>`;
    })
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e7e7e9;border-radius:8px;overflow:hidden;">
    <tr style="background:#f4f4f5;">
      <td style="padding:8px 12px;font-size:11px;font-weight:bold;color:#6b6b72;text-transform:uppercase;">Client</td>
      <td style="padding:8px 12px;font-size:11px;font-weight:bold;color:#6b6b72;text-transform:uppercase;text-align:right;">Amount</td>
      <td style="padding:8px 12px;font-size:11px;font-weight:bold;color:#6b6b72;text-transform:uppercase;">Description</td>
      <td style="padding:8px 12px;font-size:11px;font-weight:bold;color:#6b6b72;text-transform:uppercase;">Due</td>
    </tr>
    ${rows}
  </table>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Notify Eric (and configured recipients) that these auto-invoices will send tomorrow.
 * Auto-send still runs on schedule even if nobody acts on this alert.
 */
export async function notifyAutoInvoiceReviewReminder(
  items: AutoInvoiceReviewItem[],
): Promise<{ slack: number; email: boolean }> {
  if (items.length === 0) {
    return { slack: 0, email: false };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.BASE_URL || 'https://e8productions.com';
  const title = `Auto-invoice review — ${items.length} invoice(s) send tomorrow`;
  const lines = buildItemLines(items);
  const slackBody =
    `Please review these before they go out tomorrow. Edit amounts/descriptions in *Monthly Auto-Invoices* if needed.\n` +
    `If nothing is changed, they will still send automatically.\n\n` +
    `${lines}\n\n` +
    `<${appUrl}|Open E8 App → Client Management → Monthly Auto-Invoices>`;

  const ericMention = '<@U047GKLSCBD>';
  const slackUserIds = getSlackUserIds();

  let slackOk = 0;
  await Promise.all([
    ...slackUserIds.map(async (id) => {
      try {
        await sendSlackDM(id, {
          type: 'auto_invoice_review',
          title,
          body: slackBody,
        });
        slackOk += 1;
      } catch (err) {
        console.error(`[auto-invoice-review] Slack DM to ${id} failed:`, err);
      }
    }),
    sendToChannel('e8app', {
      type: 'auto_invoice_review',
      title: `${ericMention} ${title}`,
      body: slackBody,
    }).catch((err) =>
      console.error('[auto-invoice-review] e8app channel notify failed:', err),
    ),
  ]);

  const emails = getNotifyEmails();
  let emailOk = false;
  if (emails.length > 0) {
    try {
      const transporter = getTransporter();
      await transporter.sendMail({
        from: `"E8 Productions" <${process.env.SMTP_USER || 'eric@e8productions.com'}>`,
        to: emails.join(', '),
        subject: title,
        html: `
<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>body{margin:0;padding:0} @media (max-width:620px){.container{width:100%!important}.px{padding-left:24px!important;padding-right:24px!important}}</style>
</head>
<body style="margin:0;padding:0;">
<div style="background-color:#f4f4f5;margin:0;padding:0;font-family:Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:40px 16px;">
    <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:#fff;border:1px solid #d3d3d6;border-radius:12px;">
      <tr><td class="px" style="padding:28px 40px 0 40px;font-size:22px;font-weight:bold;color:#0a0a0b;">${escapeHtml(title)}</td></tr>
      <tr><td class="px" style="padding:16px 40px 0 40px;font-size:15px;line-height:1.6;color:#222225;">
        Please review these invoices before they go out <strong>tomorrow</strong>.
        You can change the amount, description, or turn a client off in <strong>Monthly Auto-Invoices</strong>.
        If nobody edits anything, they will still send automatically.
      </td></tr>
      <tr><td class="px" style="padding:20px 40px 0 40px;">${buildItemHtml(items)}</td></tr>
      <tr><td class="px" align="center" style="padding:24px 40px 32px 40px;">
        <a href="${appUrl}" style="display:inline-block;padding:12px 24px;background:#0a0a0b;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:14px;">Open E8 App</a>
      </td></tr>
    </table>
  </td></tr></table>
</div>
</body></html>`,
      });
      emailOk = true;
    } catch (err) {
      console.error('[auto-invoice-review] Email failed:', err);
    }
  }

  return { slack: slackOk, email: emailOk };
}
