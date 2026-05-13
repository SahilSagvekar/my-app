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
  title?: string;
  body?: string | null;
  message?: string | null; // Raw mrkdwn text when exact formatting matters
  payload?: Record<string, any> | null;
  userId?: number | null;
  mentionUserIds?: number[]; // User IDs to @mention in the message
}

export type SlackChannel =
  | "qc"
  | "scheduling"
  | "reports"
  | "e8app"
  | "attendance"
  | "editors"
  | "tdbs_guests";

// ---------------------------------------------------------------------------
// Channel Configuration (from environment variables)
// ---------------------------------------------------------------------------
function parseWebhookList(value?: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function getWebhookGroup(...envKeys: string[]): string[] {
  const urls = envKeys.flatMap((key) => parseWebhookList(process.env[key]));
  return [...new Set(urls)];
}

const CHANNEL_CONFIG: Record<SlackChannel, () => string[]> = {
  // QC/Quality Control channel
  qc: () => getWebhookGroup("SLACK_QC_CHANNEL_WEBHOOK_URL"),
  // Scheduling channel
  scheduling: () => getWebhookGroup("SLACK_SCHEDULING_CHANNEL_WEBHOOK_URL"),
  // Reports channel (for daily summary)
  reports: () => getWebhookGroup("SLACK_REPORT_WEBHOOK_URL"),
  // E8 App channel (for internal team notifications)
  e8app: () => getWebhookGroup("SLACK_E8_APP_CHANNEL_WEBHOOK_URL"),
  // Attendance reminder channels
  attendance: () =>
    getWebhookGroup(
      "SLACK_ATTENDANCE_CHANNEL_WEBHOOK_URLS",
      "SLACK_ATTENDANCE_CHANNEL_WEBHOOK_URL",
      "SLACK_ATTENDANCE_WEBHOOK_URLS",
      "SLACK_ATTENDANCE_WEBHOOK_URL",
    ),
  // Editor reminder channels
  editors: () =>
    getWebhookGroup(
      "SLACK_EDITORS_CHANNEL_WEBHOOK_URLS",
      "SLACK_EDITORS_CHANNEL_WEBHOOK_URL",
      "SLACK_EDITOR_CHANNEL_WEBHOOK_URLS",
      "SLACK_EDITOR_CHANNEL_WEBHOOK_URL",
      "SLACK_EDITORS_WEBHOOK_URLS",
      "SLACK_EDITORS_WEBHOOK_URL",
      "SLACK_EDITOR_WEBHOOK_URLS",
      "SLACK_EDITOR_WEBHOOK_URL",
    ),
  // TDBS Guests channel
  tdbs_guests: () =>
    getWebhookGroup("SLACK_TDBS_GUESTS_CHANNEL_WEBHOOK_URL"),
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

  const baseText = notification.message
    ? `${mentionPrefix}${notification.message}`
    : `${mentionPrefix}${emoji} *${notification.title || "Notification"}*${notification.body ? `\n${notification.body}` : ""}`;

  const blocks: any[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: baseText,
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
): Promise<boolean> {
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
      return false;
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
      return false;
    } else {
      console.log(
        `[Slack Webhook] ✅ Sent notification: "${notification.title || notification.message || notification.type}" (type=${notification.type})`,
      );
      return true;
    }
  } catch (err) {
    console.error("[Slack Webhook] Failed:", err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// 2. CLIENT WEBHOOK — Post to a client-specific channel
// ---------------------------------------------------------------------------
async function sendClientSlackWebhook(
  clientId: string,
  notification: SlackNotification
): Promise<boolean> {
  try {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { slackWebhookUrl: true, slackEnabled: true, name: true },
    });

    if (!client) {
      console.log(`[Slack Client] Client ${clientId} not found in DB`);
      return false;
    }

    if (!client.slackEnabled) {
      console.log(`[Slack Client] Slack disabled for client "${client.name}" (slackEnabled=false)`);
      return false;
    }

    if (!client.slackWebhookUrl) {
      console.log(`[Slack Client] No webhook URL for client "${client.name}" (slackEnabled=true but no URL)`);
      return false;
    }

    console.log(`[Slack Client] Sending to client "${client.name}" channel...`);
    return sendSlackWebhook(notification, client.slackWebhookUrl);
  } catch (err) {
    console.error("[Slack Client Webhook] Failed:", err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// 2b. CHANNEL-SPECIFIC WEBHOOK — Post to QC, Scheduling, E8 App, etc.
// ---------------------------------------------------------------------------
export interface SlackChannelSendResult {
  channel: SlackChannel;
  attempted: number;
  succeeded: number;
  failed: number;
  missing: boolean;
}

export async function sendToChannel(
  channel: SlackChannel,
  notification: SlackNotification
): Promise<SlackChannelSendResult> {
  const webhookUrls = CHANNEL_CONFIG[channel]();
  if (webhookUrls.length === 0) {
    console.log(`[Slack ${channel}] No webhook URL configured for ${channel} channel`);
    return {
      channel,
      attempted: 0,
      succeeded: 0,
      failed: 0,
      missing: true,
    };
  }

  console.log(
    `[Slack ${channel}] Sending notification to ${channel} group (${webhookUrls.length} webhook${webhookUrls.length === 1 ? "" : "s"})...`,
  );

  let succeeded = 0;
  let failed = 0;

  for (const webhookUrl of webhookUrls) {
    const ok = await sendSlackWebhook(notification, webhookUrl);
    if (ok) {
      succeeded++;
    } else {
      failed++;
    }
  }

  return {
    channel,
    attempted: webhookUrls.length,
    succeeded,
    failed,
    missing: false,
  };
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

    let text = notification.message || `${emoji} *${notification.title || "Notification"}*`;
    if (!notification.message && notification.body) text += `\n${notification.body}`;
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
    `[Slack Dispatch] Delivering notification: type=${notification.type}, title="${notification.title || notification.message || notification.type}", clientId=${notification.payload?.clientId || "none"}, userId=${notification.userId || "none"}`,
  );

  const notificationType = notification.type;

  // =========================================================================
  // ROUTING RULES
  // =========================================================================

  // 1. QC_READY → QC Channel ONLY (with @mention of admin Eric)
  if (notificationType === "qc_ready") {
    console.log(`[Slack Dispatch] Ready for QC → QC channel only`);

    // Hardcoded Eric's Slack ID
    const adminMention = `<@U06CNSASUUX> `;
    const taskTitle = notification.payload?.taskTitle || notification.title || "Task";

    // Create modified notification with admin mention
    const mentionedNotification = {
      ...notification,
      title: `👀 ${adminMention}Content Ready for QC Review`,
      body: `Content "${taskTitle}" is ready for review.`,
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

    const stage = notification.payload?.notificationStage;
    const taskTitle = notification.payload?.taskTitle || notification.title || "Task";
    const schedulerId = notification.payload?.schedulerId;

    // Get scheduler's Slack ID for @mention
    let schedulerMention = "";
    if (schedulerId) {
      try {
        const schedulerIdNum = Number(schedulerId);
        const scheduler = await prisma.user.findUnique({
          where: { id: schedulerIdNum },
          select: { slackUserId: true, name: true },
        });
        if (scheduler?.slackUserId) {
          schedulerMention = `<@${scheduler.slackUserId}> `;
        } else {
          schedulerMention = `@${scheduler?.name?.replace(/\s+/g, '') || "scheduler"} `;
        }
      } catch (err) {
        console.error("[Slack Dispatch] Failed to fetch scheduler:", err);
        schedulerMention = "@scheduler ";
      }
    }

    const scheduledNotification = { ...notification };

    if (stage === "ready_for_scheduling") {
      let approvedBy = "QC";
      if (notification.payload?.taskId) {
        try {
          const t = await prisma.task.findUnique({
            where: { id: notification.payload.taskId },
            include: { client: true }
          });
          if (t?.client?.requiresClientReview) approvedBy = "Client";
        } catch (e) {}
      }
      scheduledNotification.message = `:mag: :eyes: ${schedulerMention}✅ Content Approved by ${approvedBy}: Task "${taskTitle}" has been approved.`;
    } else {
      scheduledNotification.title = "Content Scheduled";
      scheduledNotification.body = `Task "${taskTitle}" has been ${stage === "posted" ? "posted" : "scheduled"}.`;
    }

    // Send to scheduling channel ONLY
    await sendToChannel("scheduling", scheduledNotification);
    return;
  }

  // 4. REVIEW_QUEUE (QC Approved, Client Review Pending) -> Scheduling Channel
  if (notificationType === "review_queue") {
    console.log(`[Slack Dispatch] Review Queue -> Scheduling channel`);
    let taskTitle = notification.title || "Task";
    let schedulerMention = "@scheduler ";

    if (notification.payload?.taskId) {
      try {
        const t = await prisma.task.findUnique({
          where: { id: notification.payload.taskId },
          select: { title: true, scheduler: true }
        });
        if (t) {
          taskTitle = t.title || taskTitle;
          if (t.scheduler) {
            const schedUser = await prisma.user.findUnique({ where: { id: Number(t.scheduler) } });
            if (schedUser?.slackUserId) {
              schedulerMention = `<@${schedUser.slackUserId}> `;
            } else {
              schedulerMention = `@${schedUser?.name?.replace(/\s+/g, '') || "scheduler"} `;
            }
          }
        }
      } catch (e) {
        console.error("[Slack Dispatch] Review queue lookup failed", e);
      }
    }

    const reviewNotification = { ...notification };
    reviewNotification.message = `:mag: :eyes: ${schedulerMention}✅ Content Approved by QC: Task "${taskTitle}" has been approved by QC (Pending Client Review).`;

    await sendToChannel("scheduling", reviewNotification);
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
  const webhookUrl = process.env.SLACKS_OPS_CHANNEL;
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
