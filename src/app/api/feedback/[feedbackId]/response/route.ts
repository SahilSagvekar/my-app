export const dynamic = 'force-dynamic';
// app/api/feedback/[feedbackId]/response/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDbHttp } from '@/lib/db';
import { feedbackResponse, feedback as feedbackTable } from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { eq } from 'drizzle-orm';
import jwt from "jsonwebtoken";

function getTokenFromCookies(req: Request) {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/authToken=([^;]+)/);
  return match ? match[1] : null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { feedbackId: string } }
) {
  const db = getDbHttp();
  try {
    const token = getTokenFromCookies(request);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    if (!decoded?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { message } = body;
    if (typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // senderId comes from the authenticated session, not the request body —
    // a client-supplied senderId would let anyone attribute a reply to
    // someone else in the thread.
    const [createdResponse] = await db.insert(feedbackResponse).values({
      id: createId(),
      message: message.trim(),
      feedbackId: params.feedbackId,
      senderId: Number(decoded.userId),
    }).returning();

    const responseRow = await db.query.feedbackResponse.findFirst({
      where: eq(feedbackResponse.id, createdResponse.id),
      with: {
        // drizzle relation key is "user" (see relations.ts); renamed to
        // "sender" below to keep the response shape identical to Prisma's
        // `include: { sender: {...} }`.
        user: {
          columns: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
    });
    const { user: sender, ...responseFields } = responseRow!;
    const response = { ...responseFields, sender };

    // Update feedback status to acknowledged if it was pending.
    // Feedback.updatedAt is @updatedAt in Prisma (client-managed) — set
    // explicitly here, matching that behavior.
    await db.update(feedbackTable).set({
      status: "acknowledged",
      updatedAt: new Date().toISOString(),
    }).where(eq(feedbackTable.id, params.feedbackId));

    return NextResponse.json({ response });
  } catch (error) {
    console.error("Error creating response:", error);
    return NextResponse.json(
      { error: "Failed to create response" },
      { status: 500 }
    );
  }
}