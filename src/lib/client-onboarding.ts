// src/lib/client-onboarding.ts
// Handles everything that should happen when a new client is created:
//   1. Create a dedicated Slack channel named after the company (always)
//   2. Invite the fixed E8 team members into that channel
//   3. Post a welcome message in the channel
//   4. At most ONE of: send a welcome email, OR send a magic-link portal
//      setup email — the caller picks, and picking neither is valid (just
//      the client record + Slack channel, nothing emailed)
//   5. Save the channel name back to the Client record in DB
//
// Quote-sending and contract-sending used to be part of this flow (via the
// pre-client provisioning route) — they've been removed from onboarding
// entirely. Quotes/contracts are now handled independently of client
// creation, wherever that's still needed.

import { WebClient } from '@slack/web-api';
import { getDbHttp } from '@/lib/db';
import { client as clientTable, onboardingToken as onboardingTokenTable } from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { eq } from 'drizzle-orm';
import { createTransporter } from '@/lib/mail-transport';
import { renderEmailShell } from '@/lib/email-shell';
import { enqueueNotification } from '@/lib/notification-queue';

// ---------------------------------------------------------------------------
// ⚙️  CONFIG — Add every Slack user ID that should join every client channel.
//    Get IDs from: Slack → click profile → ⋮ → Copy member ID  (format: U0XXXXXXXX)
// ---------------------------------------------------------------------------
const DEFAULT_CHANNEL_MEMBER_IDS: string[] = [
  'U06CNSASUUX', // Eric (admin)
  'U06CNSASUUX', //vidA
  'U0AQWFELDFH',
  'U099UJTVDE1'

];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSlackClient(): WebClient | null {
  if (!process.env.SLACK_BOT_TOKEN) {
    console.warn('[ClientOnboarding] SLACK_BOT_TOKEN not set — Slack steps skipped');
    return null;
  }
  return new WebClient(process.env.SLACK_BOT_TOKEN);
}

/** Convert a company name to a valid Slack channel name.
 *  Rules: lowercase, letters/numbers/hyphens only, max 80 chars, no leading/trailing hyphens. */
function toSlackChannelName(companyName: string): string {
  return companyName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')   // strip special chars
    .trim()
    .replace(/\s+/g, '-')            // spaces → hyphens
    .replace(/-+/g, '-')             // collapse multiple hyphens
    .replace(/^-+|-+$/g, '')         // strip leading/trailing hyphens
    .slice(0, 80)                    // Slack max
    || 'new-client';
}

// ---------------------------------------------------------------------------
// 1. Create Slack channel + invite members + post welcome
// ---------------------------------------------------------------------------

export async function createClientSlackChannel(params: {
  clientId: string;
  companyName: string;
  clientName: string;
  clientEmail: string;
}): Promise<{ channelId: string | null; channelName: string | null; webhookUrl: string | null }> {
  const db = getDbHttp();
  const slack = getSlackClient();
  if (!slack) return { channelId: null, channelName: null, webhookUrl: null };

  const channelName = toSlackChannelName(params.companyName);

  try {
    // --- Create the channel ---
    const createResult = await slack.conversations.create({
      name: channelName,
      is_private: false, // set true if you want private channels
    });

    if (!createResult.ok || !createResult.channel?.id) {
      console.error('[ClientOnboarding] Failed to create Slack channel:', createResult.error);
      return { channelId: null, channelName: null, webhookUrl: null };
    }

    const channelId = createResult.channel.id;
    console.log(`[ClientOnboarding] ✅ Slack channel created: #${channelName} (${channelId})`);

    // --- Invite default team members ---
    if (DEFAULT_CHANNEL_MEMBER_IDS.length > 0) {
      try {
        await slack.conversations.invite({
          channel: channelId,
          users: DEFAULT_CHANNEL_MEMBER_IDS.join(','),
        });
        console.log(`[ClientOnboarding] ✅ Invited ${DEFAULT_CHANNEL_MEMBER_IDS.length} members to #${channelName}`);
      } catch (inviteErr: any) {
        // Non-fatal — channel still created
        console.error('[ClientOnboarding] Failed to invite members:', inviteErr?.data?.error || inviteErr);
      }
    }

    // --- Post a welcome message in the channel ---
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    await enqueueNotification({
      kind: 'slack-dm',
      channelId,
      text: `🎉 New client onboarded: *${params.companyName}*`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `🎉 *New client onboarded!*\n\n*Company:* ${params.companyName}\n*Contact:* ${params.clientName} (${params.clientEmail})`,
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `<${appUrl}/dashboard|Open Dashboard> · This channel is dedicated to all ${params.companyName} content`,
            },
          ],
        },
      ],
    });
    await db.update(clientTable).set({
      slackChannelName: channelName,
      slackEnabled: true,
      updatedAt: new Date().toISOString(),
    }).where(eq(clientTable.id, params.clientId));

    return { channelId, channelName, webhookUrl: null };
  } catch (err: any) {
    // channel_already_exists is recoverable — find and reuse it
    if (err?.data?.error === 'name_taken') {
      console.warn(`[ClientOnboarding] Channel #${channelName} already exists — attempting to reuse`);
      try {
        const listResult = await slack.conversations.list({ limit: 1000 });
        const existing = listResult.channels?.find((c: any) => c.name === channelName);
        if (existing?.id) {
          await db.update(clientTable).set({
            slackChannelName: channelName,
            slackEnabled: true,
            updatedAt: new Date().toISOString(),
          }).where(eq(clientTable.id, params.clientId));
          return { channelId: existing.id, channelName, webhookUrl: null };
        }
      } catch { /* ignore */ }
    }
    console.error('[ClientOnboarding] Slack channel creation failed:', err?.data?.error || err?.message || err);
    return { channelId: null, channelName: null, webhookUrl: null };
  }
}

// ---------------------------------------------------------------------------
// 2. Send welcome email to the client
// ---------------------------------------------------------------------------

export async function sendClientWelcomeEmail(params: {
  clientName: string;
  companyName: string;
  email: string;
  slackChannelName: string | null;
}): Promise<boolean> {
  const smtpUser = process.env.SMTP_USER || 'noreply@e8productions.com';

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const slackNote = params.slackChannelName
    ? `<p>We've also set up a dedicated Slack channel <strong>#${params.slackChannelName}</strong> where you can communicate directly with our team.</p>`
    : '';

  const transporter = createTransporter();

  const mailOptions = {
    from: `"E8 Productions" <${smtpUser}>`,
    to: params.email,
    bcc: ['sahilsagvekar230@gmail.com', 'eric@e8productions.com'],
    subject: `Welcome to E8 Productions`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.7; color: #333; max-width: 560px; margin: 0 auto; padding: 40px 20px; }
    a { color: #0f3460; }
    .footer { margin-top: 32px; color: #9ca3af; font-size: 12px; }
  </style>
</head>
<body>
  <p>Hi ${params.clientName},</p>

  <p>Welcome to E8 Productions — we're glad to have ${params.companyName} on board.</p>

  <p>Feel free to reply to this email if you have any questions.</p>

  <p>Talk soon,<br>The E8 Productions Team</p>

  <div class="footer">
    <p>E8 Productions · <a href="${appUrl}">${appUrl}</a></p>
  </div>
</body>
</html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`[ClientOnboarding] ✅ Welcome email sent to ${params.email}`);
    return true;
  } catch (err) {
    console.error('[ClientOnboarding] Failed to send welcome email:', err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// 2b. Send magic-link portal-setup email (alternative to the welcome email —
//     the two are mutually exclusive, see onboardNewClient below). No quote
//     or contract is attached or generated here — that used to happen in
//     the pre-client provisioning flow and has been removed entirely.
// ---------------------------------------------------------------------------

export async function sendClientMagicLinkEmail(params: {
  clientId: string;
  clientName: string;
  email: string;
}): Promise<boolean> {
  const db = getDbHttp();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
  const [token] = await db.insert(onboardingTokenTable).values({
    id: createId(),
    clientId: params.clientId,
    token: createId(),
    expiresAt: expiresAt.toISOString(),
  }).returning();

  const magicLink = `${baseUrl}/onboarding/${token.token}`;

  const contentHtml = `
      <tr><td class="px" style="padding:32px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-weight:bold;font-size:22px;line-height:1.35;color:#0a0a0b;">Welcome to E8 Productions</td></tr>
      <tr><td class="px" style="padding:20px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#222225;">Hi ${params.clientName}, your E8 client portal is ready — click the button below to get started. You'll watch a quick welcome video and set your password.</td></tr>
      <tr><td class="px" align="center" style="padding:24px 40px 0 40px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td style="background-color:#0a0a0b;text-align:center;border-radius:8px;" bgcolor="#0a0a0b">
          <a href="${magicLink}" style="display:block;padding:16px 36px;font-family:Helvetica,Arial,sans-serif;font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;letter-spacing:0.2px;border-radius:8px;">Access Your Portal →</a>
        </td></tr></table>
      </td></tr>
      <tr><td class="px" style="padding:16px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:#8a8a91;">This link is one-time use and expires in 48 hours. If you didn't expect this email, please ignore it.</td></tr>`;

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"E8 Productions" <${process.env.SMTP_USER || 'noreply@e8productions.com'}>`,
      to: params.email,
      subject: `Welcome to E8 Productions — Set up your portal`,
      html: renderEmailShell({ previewText: 'Your E8 client portal is ready.', contentHtml }),
    });
    console.log(`[ClientOnboarding] ✅ Magic link email sent to ${params.email}`);
    return true;
  } catch (err) {
    console.error('[ClientOnboarding] Failed to send magic link email:', err);
    return false;
  }
}

// ---------------------------------------------------------------------------  
// 3. Master function — called from POST /api/clients and the sales-lead /
//    pre-client conversion routes. Slack channel is always created. At most
//    one of sendWelcomeEmail / sendMagicLink may be true — if both are
//    (incorrectly) passed true, welcome email wins and magic link is
//    skipped, since a UI bug shouldn't result in two separate onboarding
//    emails. If neither is true, only the Slack channel is created.
// ---------------------------------------------------------------------------

export async function onboardNewClient(params: {
  clientId: string;
  clientName: string;
  companyName: string;
  email: string;
  sendWelcomeEmail?: boolean;
  sendMagicLink?: boolean;
}): Promise<void> {
  console.log(`[ClientOnboarding] Starting onboarding for client: ${params.companyName}`);

  // Create Slack channel first so we can include the channel name in the email
  const [slackResult] = await Promise.allSettled([
    createClientSlackChannel({
      clientId: params.clientId,
      companyName: params.companyName,
      clientName: params.clientName,
      clientEmail: params.email,
    }),
  ]);

  const channelName =
    slackResult.status === 'fulfilled' ? slackResult.value.channelName : null;

  if (params.sendWelcomeEmail) {
    await sendClientWelcomeEmail({
      clientName: params.clientName,
      companyName: params.companyName,
      email: params.email,
      slackChannelName: channelName,
    }).catch(err => console.error('[ClientOnboarding] Welcome email error:', err));
  } else if (params.sendMagicLink) {
    await sendClientMagicLinkEmail({
      clientId: params.clientId,
      clientName: params.clientName,
      email: params.email,
    }).catch(err => console.error('[ClientOnboarding] Magic link email error:', err));
  } else {
    console.log(`[ClientOnboarding] No onboarding email requested for ${params.companyName} — client + Slack channel only`);
  }

  console.log(`[ClientOnboarding] ✅ Onboarding complete for ${params.companyName}`);
}