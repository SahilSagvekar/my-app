export const dynamic = 'force-dynamic';
// src/app/api/client/feedback/route.ts
//
// Receives a screenshot + optional note from the "Report a Problem"
// widget (shown on every portal) and both emails it AND saves it to the
// internal Feedback model, so it shows up in the admin Feedback queue
// (/api/feedback) instead of only existing as an email.

import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { getDbHttp } from "@/lib/db";
import { user as userTable, feedback as feedbackTable } from "@/lib/db/schema";
import { createId } from "@/lib/db/id";
import { eq } from "drizzle-orm";
import { sendClientFeedbackEmail } from "@/lib/mail-transport";

// Reasonable ceiling so a giant screenshot payload can't be abused —
// html2canvas output for a normal viewport is well under this.
const MAX_SCREENSHOT_BYTES = 8 * 1024 * 1024; // 8MB

function getTokenFromCookies(req: Request) {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/authToken=([^;]+)/);
  return match ? match[1] : null;
}

function getUserIdFromToken(token: string): number | null {
  const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
  return decoded?.userId != null ? Number(decoded.userId) : null;
}

export async function POST(req: Request) {
  const db = getDbHttp();
  const token = getTokenFromCookies(req);
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    const userId = getUserIdFromToken(token);
    if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { screenshot, message, pageUrl } = await req.json();

    if (screenshot && typeof screenshot === "string" && screenshot.length > MAX_SCREENSHOT_BYTES) {
      return NextResponse.json({ message: "Screenshot too large" }, { status: 413 });
    }

    const user = await db.query.user.findFirst({
      where: eq(userTable.id, userId),
      columns: { name: true, email: true, role: true },
      // "client" is the drizzle relation name for User.linkedClientId -> Client.id
      // (Prisma's `linkedClient` relation)
      with: { client: { columns: { name: true, companyName: true } } },
    });
    if (!user) return NextResponse.json({ message: "User not found" }, { status: 404 });

    const sourceLabel = user.client
      ? user.client.companyName || user.client.name || "Unknown Client"
      : `${user.role || "Unknown"} portal`;

    const cleanMessage = typeof message === "string" ? message.trim() : "";
    const cleanPageUrl = typeof pageUrl === "string" ? pageUrl : "";
    const cleanScreenshot = typeof screenshot === "string" ? screenshot : null;

    // Send the email and persist the queue entry independently — a failure
    // in one shouldn't silently swallow the other.
    const [emailResult, dbResult] = await Promise.allSettled([
      sendClientFeedbackEmail({
        clientName: sourceLabel,
        userName: user.name || "Unknown",
        userEmail: user.email,
        message: cleanMessage,
        pageUrl: cleanPageUrl,
        userAgent: req.headers.get("user-agent") || "",
        screenshotBase64: cleanScreenshot,
      }),
      // SCHEMA DRIFT (flagged in migration report): prisma/schema.prisma has
      // Feedback.screenshotBase64 and Feedback.pageUrl, but neither column
      // exists in src/lib/db/schema.ts (introspected from the live DB) —
      // likely a pending `prisma db push` that was never run. Dropped both
      // per hard rule 7; the screenshot/pageUrl are still emailed via
      // sendClientFeedbackEmail above, just no longer persisted to the row.
      db.insert(feedbackTable).values({
        id: createId(),
        subject: `Problem report — ${sourceLabel}`,
        message: cleanMessage || "(no note provided)",
        category: "bug_report",
        priority: "normal",
        status: "pending",
        senderId: userId,
        updatedAt: new Date().toISOString(),
      }),
    ]);

    if (emailResult.status === "rejected") {
      console.error("[POST /api/client/feedback] email failed:", emailResult.reason);
    }
    if (dbResult.status === "rejected") {
      console.error("[POST /api/client/feedback] db save failed:", dbResult.reason);
    }

    // As long as at least one of the two succeeded, the report wasn't lost.
    if (emailResult.status === "rejected" && dbResult.status === "rejected") {
      return NextResponse.json({ message: "Failed to send feedback" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[POST /api/client/feedback]", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}