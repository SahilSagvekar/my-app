// src/lib/slack.ts
import { WebClient } from "@slack/web-api";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Lazy-initialised Slack WebClient (for bot DMs)
// ---------------------------------------------------------------------------
let _slackClient: WebClient | null = null;

function getSlackClient(): WebClient | null {
  if (!process.env.SLACK_BOT_TOKEN) return null;
  if (!_slackClient) {
    _slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);
  }
  return _slackClient;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface SlackNotification {
  type: string;
  title: string;
  body?: string | null;
  payload?: Record<string, any> | null;
  userId?: number | null;
}

// ---------------------------------------------------------------------------
// Notification-type → emoji mapping for Slack messages
// ---------------------------------------------------------------------------
const TYPE_EMOJI: Record<string, string> = {
  task_assigned: "📋",
  task_created: "📝",
  content_ready: "✅",
  task_rejected: "❌",
  qc_approval: "✅",
  review_queue: "👀",
  approved_content: "🎉",
  task_scheduled: "📅",
  task_posted: "🚀",
  deadline_reminder: "⏰",
  task_deadline: "⏰",
  client_feedback: "💬",
  mention: "💬",
  system: "⚙️",
  system_alert: "🚨",
  team_update: "👥",
  user_management: "👥",
  security: "🔒",
  schedule_conflict: "📅",
  approval_request: "👁️",
  priority_review: "🔥",
};

function emojiForType(type: string): string {
  return TYPE_EMOJI[type] || "🔔";
}

// ---------------------------------------------------------------------------
// Helper — build Block Kit blocks for a notification
// ---------------------------------------------------------------------------
function buildSlackBlocks(notification: SlackNotification): any[] {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const emoji = emojiForType(notification.type);

  const blocks: any[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${emoji} *${notification.title}*${notification.body ? `\n${notification.body}` : ""}`,
      },
    },
  ];

  if (notification.payload?.taskId) {
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `<${appUrl}/dashboard?task=${notification.payload.taskId}|View Task in Dashboard>`,
        },
      ],
    });
  }

  return blocks;
}

// ---------------------------------------------------------------------------
// 1. WEBHOOK — Post to a webhook URL
//    If overrideUrl is provided, posts there instead of the global webhook.
// ---------------------------------------------------------------------------
export async function sendSlackWebhook(
  notification: SlackNotification,
  overrideUrl?: string
): Promise<void> {
  try {
    let webhookUrl = overrideUrl;

    // If no override, use global config (DB → env fallback)
    if (!webhookUrl) {
      const config = await prisma.slackConfig.findFirst({
        where: { isActive: true },
      });
      webhookUrl = config?.webhookUrl || process.env.SLACK_WEBHOOK_URL;
    }

    if (!webhookUrl) return; // Not configured — silently skip

    const blocks = buildSlackBlocks(notification);

    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocks }),
    });
  } catch (err) {
    console.error("[Slack Webhook] Failed:", err);
  }
}

// ---------------------------------------------------------------------------
// 2. CLIENT WEBHOOK — Post to a client-specific channel
// ---------------------------------------------------------------------------
async function sendClientSlackWebhook(
  clientId: string,
  notification: SlackNotification
): Promise<void> {
  try {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { slackWebhookUrl: true, slackEnabled: true, name: true },
    });

    if (!client?.slackWebhookUrl || !client.slackEnabled) return;

    await sendSlackWebhook(notification, client.slackWebhookUrl);
  } catch (err) {
    console.error("[Slack Client Webhook] Failed:", err);
  }
}

// ---------------------------------------------------------------------------
// 3. BOT DM — Send a direct message to a specific user
// ---------------------------------------------------------------------------
export async function sendSlackDM(
  slackUserId: string,
  notification: SlackNotification
): Promise<void> {
  try {
    const client = getSlackClient();
    if (!client) return; // Bot not configured

    const conversationResult = await client.conversations.open({
      users: slackUserId,
    });

    if (!conversationResult.ok || !conversationResult.channel?.id) {
      console.error("[Slack DM] Failed to open conversation with", slackUserId);
      return;
    }

    const channelId = conversationResult.channel.id;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const emoji = emojiForType(notification.type);

    let text = `${emoji} *${notification.title}*`;
    if (notification.body) text += `\n${notification.body}`;
    if (notification.payload?.taskId) {
      text += `\n<${appUrl}/dashboard?task=${notification.payload.taskId}|View Task>`;
    }

    await client.chat.postMessage({
      channel: channelId,
      text,
      mrkdwn: true,
    });
  } catch (err) {
    console.error("[Slack DM] Failed:", err);
  }
}

// ---------------------------------------------------------------------------
// 4. High-level dispatcher — called from notifyUser()
// ---------------------------------------------------------------------------
export async function deliverSlackNotification(
  notification: SlackNotification
): Promise<void> {
  // A. Special Routing: Send specific statuses to a dedicated production channel
  // Target: Ready for Review, Scheduled, Posted
  const productionChannelUrl = process.env.SLACK_READY_REVIEW_POSTED_WEBHOOK_URL;
  const productionTypes = ["review_queue", "task_scheduled", "task_posted", "content_ready"];

  if (productionChannelUrl && productionTypes.includes(notification.type)) {
    await sendSlackWebhook(notification, productionChannelUrl);
  }

  // B. Always send to global team channel webhook
  await sendSlackWebhook(notification);

  // C. Send to client-specific channel (if clientId in payload)
  if (notification.payload?.clientId) {
    await sendClientSlackWebhook(notification.payload.clientId, notification);
  }

  // C. Send DM to the targeted user (if they have Slack linked + enabled)
  if (notification.userId) {
    const user = await prisma.user.findUnique({
      where: { id: notification.userId },
      select: { slackUserId: true, slackNotifications: true },
    });

    if (user?.slackUserId && user?.slackNotifications) {
      await sendSlackDM(user.slackUserId, notification);
    }
  }
}

// ---------------------------------------------------------------------------
// 5. Utility — Send a test message to a webhook URL
// ---------------------------------------------------------------------------
export async function sendSlackTestMessage(webhookUrl: string): Promise<boolean> {
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "✅ *E8 Productions* — Slack integration is working!",
            },
          },
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: "This is a test message from your notification system.",
              },
            ],
          },
        ],
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
// ---------------------------------------------------------------------------
// 6. SPECIALIZED — Send Daily Summary Report to a specific channel
// ---------------------------------------------------------------------------
export async function sendDailySummaryToSlack(
  report: any,
  csvDownloadUrl?: string
): Promise<void> {
  const webhookUrl = process.env.SLACK_REPORT_WEBHOOK_URL;
  if (!webhookUrl || !csvDownloadUrl) return;

  try {
    const formattedDate = new Date(report.date + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const blocks: any[] = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `📊 *Daily Production Report — ${formattedDate}*`
        },
        accessory: {
          type: "button",
          text: {
            type: "plain_text",
            text: "📥 Download CSV",
            emoji: true
          },
          url: csvDownloadUrl,
          action_id: "download_report"
        }
      }
    ];

    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocks }),
    });

    console.log(`✅ [Slack Report] Minimal download link sent to dedicated channel`);
  } catch (err) {
    console.error("[Slack Report] Failed to send summary link:", err);
  }
}
