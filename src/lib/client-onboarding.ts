// src/lib/client-onboarding.ts
// Handles everything that should happen when a new client is created:
//   1. Create a dedicated Slack channel named after the company
//   2. Invite the fixed E8 team members into that channel
//   3. Post a welcome message in the channel
//   4. Send a welcome email to the client
//   5. Save the channel name back to the Client record in DB

import { WebClient } from '@slack/web-api';
import { prisma } from '@/lib/prisma';
import nodemailer from 'nodemailer';

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
    await slack.chat.postMessage({
      channel: channelId,
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

    // --- Persist channel name & mark Slack enabled on the client ---
    await prisma.client.update({
      where: { id: params.clientId },
      data: {
        slackChannelName: channelName,
        slackEnabled: true,
      },
    });

    return { channelId, channelName, webhookUrl: null };
  } catch (err: any) {
    // channel_already_exists is recoverable — find and reuse it
    if (err?.data?.error === 'name_taken') {
      console.warn(`[ClientOnboarding] Channel #${channelName} already exists — attempting to reuse`);
      try {
        const listResult = await slack.conversations.list({ limit: 1000 });
        const existing = listResult.channels?.find((c: any) => c.name === channelName);
        if (existing?.id) {
          await prisma.client.update({
            where: { id: params.clientId },
            data: { slackChannelName: channelName, slackEnabled: true },
          });
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
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpUser || !smtpPass) {
    console.warn('[ClientOnboarding] SMTP not configured — welcome email skipped');
    console.log(`[ClientOnboarding] Would have sent welcome email to ${params.email}`);
    return false;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const slackNote = params.slackChannelName
    ? `<p>We've also set up a dedicated Slack channel <strong>#${params.slackChannelName}</strong> where you can communicate directly with our team.</p>`
    : '';

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: smtpUser, pass: smtpPass },
  });

  const mailOptions = {
    from: `"E8 Productions" <${smtpUser}>`,
    to: params.email,
    bcc: ['sahilsagvekar230@gmail.com', 'eric@e8productions.com'],
    subject: `Welcome to E8 Productions, ${params.companyName}! 🎬`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); color: white; padding: 36px 30px; border-radius: 12px 12px 0 0; text-align: center; }
    .header h1 { margin: 0 0 8px; font-size: 26px; font-weight: 700; }
    .header p { margin: 0; opacity: 0.8; font-size: 15px; }
    .content { background: #f9fafb; padding: 32px 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none; }
    .highlight-box { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px 24px; margin: 20px 0; }
    .highlight-box h3 { margin: 0 0 12px; font-size: 15px; color: #111; }
    .step { display: flex; align-items: flex-start; gap: 12px; margin: 12px 0; }
    .step-num { background: #0f3460; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; flex-shrink: 0; padding-top: 1px; }
    .button { display: inline-block; background: #0f3460; color: white !important; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; margin: 8px 0; }
    .footer { text-align: center; margin-top: 28px; color: #9ca3af; font-size: 13px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🎬 Welcome to E8 Productions!</h1>
    <p>Your content production journey starts here</p>
  </div>

  <div class="content">
    <p>Hi <strong>${params.clientName}</strong>,</p>

    <p>We're thrilled to welcome <strong>${params.companyName}</strong> to E8 Productions! 🎉 Our team is ready to help you create outstanding content.</p>

    ${slackNote}

    <div class="highlight-box">
      <h3>📋 What happens next</h3>
      <div class="step"><span class="step-num">1</span><span>Our team will reach out within 1 business day to walk you through the onboarding process</span></div>
      <div class="step"><span class="step-num">2</span><span>You'll receive your login credentials to access our client portal</span></div>
      <div class="step"><span class="step-num">3</span><span>We'll review your deliverables and content schedule together</span></div>
      <div class="step"><span class="step-num">4</span><span>Production begins! Track your content in real time from the dashboard</span></div>
    </div>

    <div style="text-align: center; margin: 28px 0;">
      <a href="${appUrl}" class="button">Visit Client Portal →</a>
    </div>

    <p>If you have any questions in the meantime, don't hesitate to reach out — we're here to help.</p>

    <p>Looking forward to creating great content together!</p>

    <p>Warm regards,<br><strong>The E8 Productions Team</strong></p>
  </div>

  <div class="footer">
    <p>E8 Productions · <a href="${appUrl}" style="color: #6b7280;">e8productions.com</a></p>
    <p>You're receiving this because you were just onboarded as an E8 Productions client.</p>
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
// 3. Master function — called from POST /api/clients
// ---------------------------------------------------------------------------

export async function onboardNewClient(params: {
  clientId: string;
  clientName: string;
  companyName: string;
  email: string;
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

  // Send welcome email with the channel name included
  await sendClientWelcomeEmail({
    clientName: params.clientName,
    companyName: params.companyName,
    email: params.email,
    slackChannelName: channelName,
  }).catch(err => console.error('[ClientOnboarding] Welcome email error:', err));

  console.log(`[ClientOnboarding] ✅ Onboarding complete for ${params.companyName}`);
}