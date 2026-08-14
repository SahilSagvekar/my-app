// src/lib/upload-notifications.ts
// Handles Slack notifications for file uploads (Files & Drive)

import { getDbHttp } from "@/lib/db";
import { user as userTable, client as clientTable, task as taskTable } from "@/lib/db/schema";
import { and, eq, exists, inArray, notInArray, sql } from "drizzle-orm";
import { sendSlackWebhook, sendToChannel, SlackNotification } from "@/lib/slack";

interface UploadNotificationParams {
  fileName: string;
  fileSize: number;
  uploadedBy: number; // User ID
  clientId?: string;
  taskId?: string;
  folderType?: string; // 'rawFootage' | 'outputs' | 'drive' | 'essentials'
  s3Key?: string;
  // Admin-selected editor IDs to tag instead of auto-tagging everyone
  // assigned to the client. Omitted/undefined = old auto-tag-all behavior.
  taggedEditorIds?: string[];
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
  const db = getDbHttp();
  const editors = await db
    .select({
      id: userTable.id,
      name: userTable.name,
      role: userTable.role,
      slackUserId: userTable.slackUserId,
    })
    .from(userTable)
    .where(
      and(
        eq(userTable.role, "editor"),
        exists(
          db
            .select({ one: sql`1` })
            .from(taskTable)
            .where(
              and(
                eq(taskTable.assignedTo, userTable.id),
                eq(taskTable.clientId, clientId),
                notInArray(taskTable.status, ["COMPLETED", "POSTED"]),
              ),
            ),
        ),
      ),
    );

  return editors;
}

/**
 * Get specific editors by ID — used when admin manually picks which
 * editors to tag, instead of auto-tagging everyone assigned to the client.
 */
async function getEditorsByIds(editorIds: string[]): Promise<UploaderInfo[]> {
  const db = getDbHttp();
  const numericIds = editorIds
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id));

  if (numericIds.length === 0) return [];

  const editors = await db
    .select({
      id: userTable.id,
      name: userTable.name,
      role: userTable.role,
      slackUserId: userTable.slackUserId,
    })
    .from(userTable)
    .where(and(inArray(userTable.id, numericIds), eq(userTable.role, "editor")));

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
  const db = getDbHttp();
  const { fileName, fileSize, uploadedBy, clientId, taskId, folderType, s3Key, taggedEditorIds } = params;

  try {
    // Get uploader info
    const [uploader] = await db
      .select({
        id: userTable.id,
        name: userTable.name,
        role: userTable.role,
        slackUserId: userTable.slackUserId,
      })
      .from(userTable)
      .where(eq(userTable.id, uploadedBy))
      .limit(1);

    if (!uploader) {
      console.log(`[UploadNotification] Uploader ${uploadedBy} not found, skipping`);
      return;
    }

    // const isClientUpload = uploader.role === "client";
    const isRawFootageUpload = !!(s3Key && s3Key.includes("raw-footage/"));
    const isClientUpload = uploader.role === "client" || isRawFootageUpload;

    const formattedSize = formatFileSize(fileSize);
    const folderPath = getFolderPath(s3Key);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // Build notification message
    let title: string;
    let body: string;
    let mentionString = "";

    if (isClientUpload && clientId) {
      // Client upload - send to client channel and tag editors
      const [client] = await db
        .select({
          id: clientTable.id,
          name: clientTable.name,
          companyName: clientTable.companyName,
          slackEnabled: clientTable.slackEnabled,
          slackWebhookUrl: clientTable.slackWebhookUrl,
        })
        .from(clientTable)
        .where(eq(clientTable.id, clientId))
        .limit(1);

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

      // Get editors to mention — admin's manual picks take priority,
      // otherwise fall back to auto-tagging everyone assigned to the client.
      const editors =
        taggedEditorIds && taggedEditorIds.length > 0
          ? await getEditorsByIds(taggedEditorIds)
          : await getClientAssignedEditors(clientId);
      if (editors.length > 0) {
        mentionString = buildMentions(editors);
        console.log(
          `[UploadNotification] Tagging ${editors.length} editors (${taggedEditorIds && taggedEditorIds.length > 0 ? "manually selected" : "auto-assigned"}): ${editors.map((e) => e.name).join(", ")}`
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
        const [client] = await db
          .select({ name: clientTable.name, companyName: clientTable.companyName })
          .from(clientTable)
          .where(eq(clientTable.id, clientId))
          .limit(1);
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