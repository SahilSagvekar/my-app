export const dynamic = 'force-dynamic';
// src/app/api/client/feedback/route.ts
//
// Receives a screenshot + optional note from the "Report a Problem"
// widget (shown on every portal) and emails it straight out. Nothing is
// persisted to the database — this is an email pipe, not a ticket system
// (the internal admin Feedback model at /api/feedback is separate).

import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";
import { sendClientFeedbackEmail } from "@/lib/email";

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
  const token = getTokenFromCookies(req);
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    const userId = getUserIdFromToken(token);
    if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { screenshot, message, pageUrl } = await req.json();

    if (screenshot && typeof screenshot === "string" && screenshot.length > MAX_SCREENSHOT_BYTES) {
      return NextResponse.json({ message: "Screenshot too large" }, { status: 413 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        email: true,
        role: true,
        linkedClient: { select: { name: true, companyName: true } },
      },
    });
    if (!user) return NextResponse.json({ message: "User not found" }, { status: 404 });

    const sourceLabel = user.linkedClient
      ? user.linkedClient.companyName || user.linkedClient.name || "Unknown Client"
      : `${user.role || "Unknown"} portal`;

    await sendClientFeedbackEmail({
      clientName: sourceLabel,
      userName: user.name || "Unknown",
      userEmail: user.email,
      message: typeof message === "string" ? message.trim() : "",
      pageUrl: typeof pageUrl === "string" ? pageUrl : "",
      userAgent: req.headers.get("user-agent") || "",
      screenshotBase64: typeof screenshot === "string" ? screenshot : null,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[POST /api/client/feedback]", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}