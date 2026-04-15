// src/lib/upload-notifications.ts
// Handles Slack notifications for file uploads (Files & Drive)

import { prisma } from "@/lib/prisma";
import { sendSlackWebhook, sendToChannel, SlackNotification } from "@/lib/slack";

interface UploadNotificationParams {
  fileName: string;
  fileSize: number;
  uploadedBy: number; // User ID
  clientId?: string;
  taskId?: string;
  folderType?: string; // 'rawFootage' | 'outputs' | 'drive' | 'essentials'
  s3Key?: string;
}

interface UploaderInfo {
  id: number;
  name: string | null;
  role: string | null;
  slackUserId: string | null;
}

/**
 * Get assigned editors for a client's tasks
 */
async function getClientAssignedEditors(clientId: string): Promise<UploaderInfo[]> {
  const editors = await prisma.user.findMany({
    where: {
      role: "editor",
      assignedTasks: {
        some: {
          clientId: clientId,
          status: {
            notIn: ["COMPLETED", "POSTED"],
          },
        },
      },
    },
    select: {
      id: true,
      name: true,
      role: true,
      slackUserId: true,
    },
    distinct: ["id"],
  });

  return editors;
}

/**
 * Format file size to human readable string
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * Build Slack mentions string from user IDs
 */
function buildMentions(users: UploaderInfo[]): string {
  return users
    .filter((u) => u.slackUserId)
    .map((u) => `<@${u.slackUserId}>`)
    .join(" ");
}

/**
 * Get folder path from S3 key for display
 */
function getFolderPath(s3Key?: string): string {
  if (!s3Key) return "";
  const parts = s3Key.split("/");
  // Remove filename, keep folder path
  parts.pop();
  return parts.join("/") || "/";
}

/**
 * Send upload notification to appropriate Slack channel
 * 
 * Rules:
 * - Client uploads → Client's Slack channel + tag assigned editors
 * - Non-client uploads → E8 App channel
 */
export async function sendUploadNotification(
  params: UploadNotificationParams
): Promise<void> {
  const { fileName, fileSize, uploadedBy, clientId, taskId, folderType, s3Key } = params;

  try {
    // Get uploader info
    const uploader = await prisma.user.findUnique({
      where: { id: uploadedBy },
      select: {
        id: true,
        name: true,
        role: true,
        slackUserId: true,
      },
    });

    if (!uploader) {
      console.log(`[UploadNotification] Uploader ${uploadedBy} not found, skipping`);
      return;
    }

    const isClientUpload = uploader.role === "client";
    const formattedSize = formatFileSize(fileSize);
    const folderPath = getFolderPath(s3Key);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // Build notification message
    let title: string;
    let body: string;
    let mentionString = "";

    if (isClientUpload && clientId) {
      // Client upload - send to client channel and tag editors
      const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: {
          id: true,
          name: true,
          companyName: true,
          slackEnabled: true,
          slackWebhookUrl: true,
        },
      });

      if (!client) {
        console.log(`[UploadNotification] Client ${clientId} not found, skipping`);
        return;
      }

      if (!client.slackEnabled || !client.slackWebhookUrl) {
        console.log(
          `[UploadNotification] Slack not enabled for client "${client.name}", skipping`
        );
        return;
      }

      // Get assigned editors to mention
      const editors = await getClientAssignedEditors(clientId);
      if (editors.length > 0) {
        mentionString = buildMentions(editors);
        console.log(
          `[UploadNotification] Tagging ${editors.length} editors: ${editors.map((e) => e.name).join(", ")}`
        );
      }

      title = `New Upload from ${uploader.name || "Client"}`;
      body = `*File:* ${fileName}\n*Size:* ${formattedSize}\n*Location:* \`${folderPath}\``;

      if (mentionString) {
        title = `${mentionString} ${title}`;
      }

      const notification: SlackNotification = {
        type: "file_uploaded",
        title,
        body,
        payload: { taskId, clientId, fileName, fileSize, folderType },
      };

      // Send to client's Slack channel
      await sendSlackWebhook(notification, client.slackWebhookUrl);
      console.log(
        `[UploadNotification] ✅ Sent to client "${client.name}" channel`
      );
    } else {
      // Non-client upload - send to E8 App channel
      // Get client name if available
      let clientName = "";
      if (clientId) {
        const client = await prisma.client.findUnique({
          where: { id: clientId },
          select: { name: true, companyName: true },
        });
        clientName = client?.companyName || client?.name || "";
      }

      title = `📤 File Uploaded by ${uploader.name || "User"} (${uploader.role || "unknown"})`;
      body = `*File:* ${fileName}\n*Size:* ${formattedSize}`;
      
      if (clientName) {
        body += `\n*Client:* ${clientName}`;
      }
      body += `\n*Location:* \`${folderPath}\``;

      const notification: SlackNotification = {
        type: "file_uploaded",
        title,
        body,
        payload: { taskId, clientId, fileName, fileSize, folderType },
      };

      // Use sendToChannel which handles missing webhook gracefully
      await sendToChannel("e8app", notification);
      console.log(`[UploadNotification] ✅ Sent to E8 App channel`);
    }
  } catch (err) {
    console.error("[UploadNotification] Failed:", err);
  }
}

/**
 * Send drive upload notification (for direct drive uploads without task context)
 */
export async function sendDriveUploadNotification(params: {
  fileName: string;
  fileSize: number;
  uploadedBy: number;
  s3Key: string;
  clientId?: string;
}): Promise<void> {
  return sendUploadNotification({
    ...params,
    folderType: "drive",
  });
}