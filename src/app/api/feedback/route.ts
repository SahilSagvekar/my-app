export const dynamic = 'force-dynamic';
// app/api/feedback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from '@/lib/db';
import { feedback as feedbackTable } from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { eq, desc, asc } from 'drizzle-orm';
import jwt from "jsonwebtoken";

function getTokenFromCookies(req: Request) {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/authToken=([^;]+)/);
  return match ? match[1] : null;
}

// GET - Fetch all feedback
export async function GET(request: NextRequest) {
  const { db, closeDb } = getDb();
  try {
  try {
    const token = getTokenFromCookies(request);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    if (!decoded?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = Number(decoded.userId);
    // Real role from the token, not the ?userRole= query param — that was
    // previously trusted as-is, so anyone could pass userRole=admin and see
    // every submission (including other people's screenshots).
    const userRole = (decoded.role || "").toLowerCase();

    let rawFeedback;

    if (userRole === "admin" || userRole === "manager") {
      // Admin and managers see all feedback
      rawFeedback = await db.query.feedback.findMany({
        with: {
          user: { columns: { id: true, name: true, role: true } },
          feedbackResponses: {
            with: { user: { columns: { id: true, name: true, role: true } } },
            orderBy: (fr, { asc }) => [asc(fr.createdAt)],
          },
        },
        orderBy: (f, { desc }) => [desc(f.createdAt)],
      });
    } else {
      // Other users only see their own feedback
      rawFeedback = await db.query.feedback.findMany({
        where: eq(feedbackTable.senderId, userId),
        with: {
          user: { columns: { id: true, name: true, role: true } },
          feedbackResponses: {
            with: { user: { columns: { id: true, name: true, role: true } } },
            orderBy: (fr, { asc }) => [asc(fr.createdAt)],
          },
        },
        orderBy: (f, { desc }) => [desc(f.createdAt)],
      });
    }

    // Drizzle relation keys are "user" (sender) and "feedbackResponses"
    // (responses), each response also nesting "user" — renamed below to
    // keep the response shape identical to the original Prisma include.
    const feedback = rawFeedback.map(({ user: sender, feedbackResponses, ...rest }) => ({
      ...rest,
      sender,
      responses: feedbackResponses.map(({ user: respSender, ...respRest }) => ({
        ...respRest,
        sender: respSender,
      })),
    }));

    return NextResponse.json({ feedback });
  } catch (error) {
    console.error("Error fetching feedback:", error);
    return NextResponse.json(
      { error: "Failed to fetch feedback" },
      { status: 500 }
    );
  }

  } finally {
    await closeDb();
  }
}

// POST - Create new feedback
export async function POST(request: NextRequest) {
  const { db, closeDb } = getDb();
  try {
  try {
    const body = await request.json();
    const { subject, message, category, priority, senderId } = body;

    const [createdFeedback] = await db.insert(feedbackTable).values({
      id: createId(),
      subject,
      message,
      category,
      priority,
      status: "pending",
      senderId: parseInt(senderId),
      updatedAt: new Date().toISOString(),
    }).returning();

    const feedbackRow = await db.query.feedback.findFirst({
      where: eq(feedbackTable.id, createdFeedback.id),
      with: {
        user: { columns: { id: true, name: true, role: true } },
      },
    });
    const { user: sender, ...rest } = feedbackRow!;
    const feedback = { ...rest, sender };

    return NextResponse.json({ feedback });
  } catch (error) {
    console.error("Error creating feedback:", error);
    return NextResponse.json(
      { error: "Failed to create feedback" },
      { status: 500 }
    );
  }

  } finally {
    await closeDb();
  }
}