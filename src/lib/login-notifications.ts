// src/lib/login-notifications.ts
// Fires a Slack notification whenever a client adds a new login.
// Tags all active schedulers and admins by their Slack user IDs.
// Falls back gracefully when no Slack IDs are configured.

import { prisma } from "@/lib/prisma";
import { sendToChannel } from "@/lib/slack";

interface LoginAddedPayload {
  platform: string;
  clientName: string | null;   // null for admin-only logins
  addedByName: string;
  addedByRole: string;
  isAdminOnly: boolean;
}

export async function notifyLoginAdded(payload: LoginAddedPayload): Promise<void> {
  const { platform, clientName, addedByName, addedByRole, isAdminOnly } = payload;

  // Fetch all active schedulers + admins who have a Slack user ID set
  const notifyUsers = await prisma.user.findMany({
    where: {
      role: { in: ["scheduler", "admin"] },
      employeeStatus: "ACTIVE",
      slackUserId: { not: null },
    },
    select: { slackUserId: true, role: true, name: true },
  });

  // Build mention string — e.g. "<@U123> <@U456>"
  const mentions = notifyUsers
    .map((u) => `<@${u.slackUserId}>`)
    .join(" ");

  // Compose message
  let contextLine: string;
  if (isAdminOnly) {
    contextLine = `An admin-only *${platform}* login was added by *${addedByName}* (${addedByRole}).`;
  } else {
    const clientPart = clientName ? `for client *${clientName}*` : "for an unspecified client";
    contextLine = `A new *${platform}* login was added ${clientPart} by *${addedByName}* (${addedByRole}).`;
  }

  const message = mentions
    ? `🔐 *New Login Added*\n${mentions}\n${contextLine}`
    : `🔐 *New Login Added*\n${contextLine}`;

  await sendToChannel("e8app", {
    type: "login_added",
    message,
  });

  console.log(
    `[login-notifications] ✅ Notified ${notifyUsers.length} user(s) about new "${platform}" login` +
      (clientName ? ` (client: ${clientName})` : " (admin-only)")
  );
}