// src/lib/meeting-notes.ts
// Creates and exports per-client weekly meeting notes docs, copied from a
// single shared Google Doc template. Reuses the same OAuth Drive client
// pattern as src/lib/googleDrive.ts (personal-quota OAuth, not the service
// account) so copies land in the same Drive the rest of the app writes to.

import { google } from "googleapis";
import { prisma } from "@/lib/prisma";

function getOAuthClient() {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/oauth2callback"
  );
  client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return client;
}

function getOAuthDrive() {
  return google.drive({ version: "v3", auth: getOAuthClient() });
}

function formatMeetingDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Copies the shared meeting-notes template into a client's Drive folder
 * (if the client has one) and records it as a new MeetingNote row.
 * Called when an admin clicks "Start This Week's Notes" for a client.
 */
export async function createMeetingNotesDoc(clientId: string, meetingDate: Date = new Date()) {
  const templateId = process.env.MEETING_NOTES_TEMPLATE_ID;
  if (!templateId) throw new Error("Missing MEETING_NOTES_TEMPLATE_ID env var");

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) throw new Error("Client not found");

  const drive = getOAuthDrive();
  const title = `${client.name} — Meeting Notes — ${formatMeetingDate(meetingDate)}`;

  const copyRes = await drive.files.copy({
    fileId: templateId,
    requestBody: {
      name: title,
      ...(client.driveFolderId ? { parents: [client.driveFolderId] } : {}),
    },
    fields: "id, webViewLink",
  });

  const driveDocId = copyRes.data.id;
  const driveDocUrl = copyRes.data.webViewLink;
  if (!driveDocId || !driveDocUrl) {
    throw new Error("Drive copy did not return a file ID/link");
  }

  const meetingNote = await prisma.meetingNote.create({
    data: {
      clientId,
      driveDocId,
      driveDocUrl,
      title,
      meetingDate,
      status: "draft",
    },
  });

  return meetingNote;
}

/**
 * Exports a meeting notes Google Doc as a PDF buffer, ready to email.
 */
export async function exportMeetingNotesPdf(driveDocId: string): Promise<Buffer> {
  const drive = getOAuthDrive();
  const res = await drive.files.export(
    { fileId: driveDocId, mimeType: "application/pdf" },
    { responseType: "arraybuffer" }
  );
  return Buffer.from(res.data as ArrayBuffer);
}