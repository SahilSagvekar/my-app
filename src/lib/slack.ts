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
  content_ready: "✅",
  task_rejected: "❌",
  qc_approval: "✅",
  review_queue: "👀",
  approved_content: "🎉",
  task_scheduled: "📅",
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
// 1. WEBHOOK — Post to team channel
// ---------------------------------------------------------------------------
export async function sendSlackWebhook(
  notification: SlackNotification
): Promise<void> {
  try {
    // Try DB config first, then env var fallback
    const config = await prisma.slackConfig.findFirst({
      where: { isActive: true },
    });

    const webhookUrl = config?.webhookUrl || process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) return; // Not configured — silently skip

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const emoji = emojiForType(notification.type);

    // Build Slack Block Kit message
    const blocks: any[] = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${emoji} *${notification.title}*${notification.body ? `\n${notification.body}` : ""}`,
        },
      },
    ];

    // Add a task link if payload contains taskId
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
// 2. BOT DM — Send a direct message to a specific user
// ---------------------------------------------------------------------------
export async function sendSlackDM(
  slackUserId: string,
  notification: SlackNotification
): Promise<void> {
  try {
    const client = getSlackClient();
    if (!client) return; // Bot not configured

    // Open a DM conversation with the user
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
// 3. High-level dispatcher — called from notifyUser()
// ---------------------------------------------------------------------------
export async function deliverSlackNotification(
  notification: SlackNotification
): Promise<void> {
  // A. Always send to team channel webhook (if configured)
  await sendSlackWebhook(notification);

  // B. If notification targets a specific user, try DM
  console.log("[Slack DM] Checking user:", notification.userId);

  if (notification.userId) {
    const user = await prisma.user.findUnique({
      where: { id: notification.userId },
      select: { slackUserId: true, slackNotifications: true },
    });

    console.log("[Slack DM] DB lookup result:", {
      userId: notification.userId,
      slackUserId: user?.slackUserId ?? "NULL",
      slackNotifications: user?.slackNotifications ?? "NULL",
    });

    if (user?.slackUserId && user?.slackNotifications) {
      console.log("[Slack DM] Sending DM to:", user.slackUserId);
      await sendSlackDM(user.slackUserId, notification);
    } else {
      console.log("[Slack DM] Skipped — slackUserId or slackNotifications not set");
    }
  } else {
    console.log("[Slack DM] Skipped — no userId in notification");
  }
}

// ---------------------------------------------------------------------------
// 4. Utility — Send a test message to the configured webhook
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
