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
  mentionUserIds?: number[]; // User IDs to @mention in the message
}

// ---------------------------------------------------------------------------
// Channel Configuration (from environment variables)
// ---------------------------------------------------------------------------
const CHANNEL_CONFIG = {
  // QC/Quality Control channel
  qc: () => process.env.SLACK_QC_CHANNEL_WEBHOOK_URL,
  // Scheduling channel
  scheduling: () => process.env.SLACK_SCHEDULING_CHANNEL_WEBHOOK_URL,
  // Reports channel (for daily summary)
  reports: () => process.env.SLACK_REPORT_WEBHOOK_URL,
  // E8 App channel (for internal team notifications)
  e8app: () => process.env.SLACK_E8_APP_CHANNEL_WEBHOOK_URL,
};

// ---------------------------------------------------------------------------
// Notification-type → emoji mapping for Slack messages
// ---------------------------------------------------------------------------
const TYPE_EMOJI: Record<string, string> = {
  task_rejected: "❌",
  qc_ready: "🔍",
  task_scheduled: "📅",
  file_uploaded: "📤",
};

function emojiForType(type: string): string {
  return TYPE_EMOJI[type] || "🔔";
}

// ---------------------------------------------------------------------------
// Helper — Get Slack user mentions from user IDs
// ---------------------------------------------------------------------------
async function getSlackMentions(userIds: number[]): Promise<string> {
  if (!userIds || userIds.length === 0) return "";

  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, slackUserId: true },
  });

  const mentions = users
    .map((u) => {
      if (u.slackUserId) {
        return `<@${u.slackUserId}>`; // Slack mention format
      }
      return u.name || `User #${u.id}`; // Fallback to name
    })
    .join(" ");

  return mentions;
}

// ---------------------------------------------------------------------------
// Helper — build Block Kit blocks for a notification
// ---------------------------------------------------------------------------
async function buildSlackBlocks(notification: SlackNotification): Promise<any[]> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const emoji = emojiForType(notification.type);

  // Build mention string if needed
  let mentionPrefix = "";
  if (notification.mentionUserIds && notification.mentionUserIds.length > 0) {
    mentionPrefix = await getSlackMentions(notification.mentionUserIds);
    if (mentionPrefix) mentionPrefix += " ";
  }

  const blocks: any[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${mentionPrefix}${emoji} *${notification.title}*${notification.body ? `\n${notification.body}` : ""}`,
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

    if (!webhookUrl) {
      console.log(`[Slack Webhook] Skipped — no webhook URL configured (override=${!!overrideUrl})`);
      return;
    }

    const blocks = await buildSlackBlocks(notification);

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocks }),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => 'unknown');
      console.error(`[Slack Webhook] Failed with status ${res.status}: ${errorText} (url=${webhookUrl.substring(0, 60)}...)`);
    } else {
      console.log(`[Slack Webhook] ✅ Sent notification: "${notification.title}" (type=${notification.type})`);
    }
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

    if (!client) {
      console.log(`[Slack Client] Client ${clientId} not found in DB`);
      return;
    }

    if (!client.slackEnabled) {
      console.log(`[Slack Client] Slack disabled for client "${client.name}" (slackEnabled=false)`);
      return;
    }

    if (!client.slackWebhookUrl) {
      console.log(`[Slack Client] No webhook URL for client "${client.name}" (slackEnabled=true but no URL)`);
      return;
    }

    console.log(`[Slack Client] Sending to client "${client.name}" channel...`);
    await sendSlackWebhook(notification, client.slackWebhookUrl);
  } catch (err) {
    console.error("[Slack Client Webhook] Failed:", err);
  }
}

// ---------------------------------------------------------------------------
// 2b. CHANNEL-SPECIFIC WEBHOOK — Post to QC, Scheduling, E8 App, etc.
// ---------------------------------------------------------------------------
export async function sendToChannel(
  channel: keyof typeof CHANNEL_CONFIG,
  notification: SlackNotification
): Promise<void> {
  const webhookUrl = CHANNEL_CONFIG[channel]();
  if (!webhookUrl) {
    console.log(`[Slack ${channel}] No webhook URL configured for ${channel} channel`);
    return;
  }
  console.log(`[Slack ${channel}] Sending notification to ${channel} channel...`);
  await sendSlackWebhook(notification, webhookUrl);
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
  notification: SlackNotification,
): Promise<void> {
  console.log(
    `[Slack Dispatch] Delivering notification: type=${notification.type}, title="${notification.title}", clientId=${notification.payload?.clientId || "none"}, userId=${notification.userId || "none"}`,
  );

  const notificationType = notification.type;

  // =========================================================================
  // ROUTING RULES
  // =========================================================================

  // 1. QC_READY → QC Channel ONLY (with @mention of QC specialist)
  if (notificationType === "qc_ready") {
    console.log(`[Slack Dispatch] Ready for QC → QC channel only`);

    // Get QC specialist's Slack ID for @mention
    let qcMention = "";
    const qcId = notification.payload?.qcId || notification.userId;
    if (qcId) {
      const qcUser = await prisma.user.findUnique({
        where: { id: qcId },
        select: { slackUserId: true, name: true },
      });
      if (qcUser?.slackUserId) {
        qcMention = `<@${qcUser.slackUserId}> `;
        console.log(
          `[Slack Dispatch] Tagging QC: ${qcUser.name} (${qcUser.slackUserId})`,
        );
      }
    }

    // Create modified notification with QC mention
    const mentionedNotification = {
      ...notification,
      title: `👀 @Eric Davis Content Ready for QC Review`,
      // title: `👀 ${qcMention}Content Ready for QC Review`,
      body: `Your content "${notification.payload?.taskTitle || notification.title || "Task"}" is ready for review.`,
    };

    // Send to QC channel ONLY
    await sendToChannel("qc", mentionedNotification);
    return;
  }

  // 2. TASK_REJECTED → Client channel ONLY (with @mention of editor + revision comments)
  if (notificationType === "task_rejected") {
    console.log(`[Slack Dispatch] Task Rejected → Client channel only`);

    // Only send if there's a clientId
    if (!notification.payload?.clientId) {
      console.log(`[Slack Dispatch] No clientId provided, skipping task_rejected notification`);
      return;
    }

    // Get editor's Slack ID for @mention
    let editorMention = "";
    const editorId = notification.payload?.editorId || notification.userId;
    if (editorId) {
      const editor = await prisma.user.findUnique({
        where: { id: editorId },
        select: { slackUserId: true, name: true },
      });
      if (editor?.slackUserId) {
        editorMention = `<@${editor.slackUserId}> `;
        console.log(
          `[Slack Dispatch] Tagging editor: ${editor.name} (${editor.slackUserId})`,
        );
      }
    }

    // Fetch recent revision comments (added during this rejection)
    let revisionComments = "";
    const taskId = notification.payload?.taskId;
    if (taskId) {
      try {
        // Get feedback added in the last 5 minutes (likely from this rejection)
        const recentFeedback = await prisma.taskFeedback.findMany({
          where: {
            taskId: taskId,
            status: "needs_revision",
            createdAt: {
              gte: new Date(Date.now() - 5 * 60 * 1000), // Last 5 minutes
            },
          },
          select: {
            feedback: true,
            folderType: true,
            timestamp: true,
            user: {
              select: { name: true },
            },
          },
          orderBy: { createdAt: "asc" },
          take: 10, // Limit to 10 comments to avoid message overflow
        });

        if (recentFeedback.length > 0) {
          revisionComments = "\n\n*Revision Notes:*\n";
          revisionComments += recentFeedback
            .map((fb) => {
              let comment = `• ${fb.feedback}`;
              if (fb.timestamp) {
                comment += ` _(at ${fb.timestamp})_`;
              }
              if (fb.folderType && fb.folderType !== "main") {
                comment += ` [${fb.folderType}]`;
              }
              return comment;
            })
            .join("\n");
          
          console.log(
            `[Slack Dispatch] Including ${recentFeedback.length} revision comments`
          );
        }
      } catch (err) {
        console.error("[Slack Dispatch] Failed to fetch revision comments:", err);
      }
    }

    // Create modified notification with editor mention and revision comments
    const mentionedNotification = {
      ...notification,
      title: `${editorMention}Content Needs Revisions`,
      body: `Your content "${notification.payload?.taskTitle || "Task"}" needs revisions.${revisionComments}`,
    };

    // Send to client channel ONLY
    await sendClientSlackWebhook(
      notification.payload.clientId,
      mentionedNotification,
    );
    return;
  }

  // 3. TASK_SCHEDULED → Scheduling Channel ONLY
  if (notificationType === "task_scheduled") {
    console.log(`[Slack Dispatch] Task Scheduled → Scheduling channel only`);

    const scheduledNotification = {
      ...notification,
      title: `Content Scheduled/Posted`,
      body: `Task "${notification.payload?.taskTitle || notification.title || "Task"}" has been marked as scheduled.`,
    };

    // Send to scheduling channel ONLY
    await sendToChannel("scheduling", scheduledNotification);
    return;
  }

  // =========================================================================
  // ALL OTHER NOTIFICATION TYPES ARE IGNORED
  // =========================================================================
  console.log(`[Slack Dispatch] Notification type "${notificationType}" is not configured for Slack - skipping`);
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