// src/lib/dev-portal-report.ts
//
// Turns a "Report a Problem" submission (any portal) into a Dev Portal
// ticket. Called from /api/client/feedback.
import { or, eq } from "drizzle-orm";
import { getDbHttp } from "@/lib/db";
import { devTicket, devTicketAttachment, user as userTable } from "@/lib/db/schema";
import { createId } from "@/lib/db/id";
import { notifyUser } from "@/lib/notify";
import { uploadBufferToS3 } from "@/lib/s3";
import { DEV_PORTAL_EMAILS } from "@/lib/dev-portal-access";

const DATA_URL_RE = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/;

export async function createDevTicketFromReport(opts: {
  reporterId: number;
  reporterName: string;
  isClient: boolean;
  clientId: string | null;
  clientName: string | null;
  sourceLabel: string;
  message: string;
  pageUrl: string;
  userAgent: string;
  screenshotDataUrl: string | null;
}) {
  const db = getDbHttp();

  const firstLine = opts.message.split("\n")[0].trim();
  const title = (firstLine || `Problem report from ${opts.sourceLabel}`).slice(0, 120);

  const details = [
    opts.message,
    opts.pageUrl ? `Page: ${opts.pageUrl}` : "",
    `Reported by: ${opts.reporterName} (${opts.sourceLabel})`,
    opts.userAgent ? `Browser: ${opts.userAgent}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const ticketId = createId();
  await db.insert(devTicket).values({
    id: ticketId,
    title,
    description: details,
    type: "BUG",
    source: opts.isClient ? "CLIENT" : "INTERNAL",
    clientId: opts.clientId,
    clientName: opts.clientName,
    reporterId: opts.reporterId,
    updatedAt: new Date().toISOString(),
  });

  // Screenshot -> R2 attachment. A failure here must not lose the ticket.
  const m = opts.screenshotDataUrl?.match(DATA_URL_RE);
  if (m) {
    try {
      const ext = m[1].split("/")[1].split("+")[0] || "png";
      const fileName = `report-${Date.now()}.${ext}`;
      const buffer = Buffer.from(m[2], "base64");
      const upload = await uploadBufferToS3({
        buffer,
        folderPrefix: `dev-portal/${ticketId}/`,
        filename: fileName,
        mimeType: m[1],
      });
      await db.insert(devTicketAttachment).values({
        id: createId(),
        ticketId,
        r2Key: upload.key,
        fileName,
        mimeType: m[1],
        size: buffer.length,
        uploadedById: opts.reporterId,
      });
    } catch (err) {
      console.warn("[DevPortal] report screenshot upload failed:", err);
    }
  }

  const recipients = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(or(...DEV_PORTAL_EMAILS.map((e) => eq(userTable.email, e))));
  await Promise.allSettled(
    recipients
      .filter((r) => r.id !== opts.reporterId)
      .map((r) =>
        notifyUser({
          userId: r.id,
          type: "dev_ticket_report",
          title: opts.isClient ? "Client reported a problem" : "New problem report",
          body: `${opts.sourceLabel}: ${title}`,
          payload: { ticketId },
        })
      )
  );

  return ticketId;
}
