// src/lib/mail-transport.ts
//
// Drop-in replacement for nodemailer.createTransport(...). email.ts and
// email-notifications.ts together have ~24 functions that each build a
// `mailOptions` object and call `transporter.sendMail(mailOptions)` —
// pointing both files at this instead is enough to route every email the
// app sends through the notifications queue, with zero changes to any
// individual send function.

import { enqueueNotification } from '@/lib/notification-queue';

// Every email in the app is BCC'd here, unconditionally — this is the one
// chokepoint all ~24 email functions plus every standalone route (stripe
// webhook, contact form, signwell, pre-clients, portal intake, etc.) pass
// through, so this is enforced centrally rather than depending on each
// function remembering to call its own addGlobalBcc() correctly.
const ALWAYS_BCC = 'sahilsagvekar230@gmail.com';

function withAlwaysBcc(mailOptions: any) {
  const existing = mailOptions.bcc;
  const existingList: string[] = !existing ? [] : Array.isArray(existing) ? existing : [existing];
  if (existingList.includes(ALWAYS_BCC)) return mailOptions; // don't duplicate
  return { ...mailOptions, bcc: [...existingList, ALWAYS_BCC] };
}

// "Configured" now means "can be enqueued", not "SMTP creds present in
// this process" — the actual SMTP send happens in e8-file-server, whose
// env is independent of this Worker's. Always true in production.
function isEmailConfigured(): boolean {
  return true;
}

function createTransporter() {
  return {
    sendMail: async (mailOptions: any) => {
      const withBcc = withAlwaysBcc(mailOptions);

      // Buffer attachments don't survive JSON serialization over the
      // Cloudflare Queue — convert to base64 (nodemailer natively accepts
      // { content, encoding: 'base64' }, so e8-file-server's real send
      // needs no changes to handle this).
      const safeMailOptions = { ...withBcc };
      if (Array.isArray(withBcc.attachments) && withBcc.attachments.length > 0) {
        safeMailOptions.attachments = withBcc.attachments.map((att: any) => {
          if (Buffer.isBuffer(att.content)) {
            return { ...att, content: att.content.toString('base64'), encoding: 'base64' };
          }
          return att;
        });
      }

      const ok = await enqueueNotification({ kind: 'email', mailOptions: safeMailOptions });
      return {
        accepted: ok ? [mailOptions.to] : [],
        rejected: ok ? [] : [mailOptions.to],
        messageId: undefined,
      };
    },
    verify: async () => true,
  };
}

export { createTransporter, isEmailConfigured };