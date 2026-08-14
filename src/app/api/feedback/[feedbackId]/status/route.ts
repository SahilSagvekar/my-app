export const dynamic = 'force-dynamic';
// app/api/feedback/[feedbackId]/status/route.ts
//
// Updates a feedback item's status and/or priority (used by the admin
// Feedback queue to triage — despite the path name, it handles both fields
// rather than adding a second near-identical route).
import { NextRequest, NextResponse } from "next/server";
import { getDb } from '@/lib/db';
import { feedback as feedbackTable } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { feedbackId: string } }
) {
  const { db, closeDb } = getDb();
  try {
  try {
    const body = await request.json();
    const { status, priority } = body;

    const data: { status?: string; priority?: string } = {};
    if (typeof status === "string") data.status = status;
    if (typeof priority === "string") data.priority = priority;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    // Feedback.updatedAt is @updatedAt in Prisma (client-managed, no DB
    // default) — set explicitly on every update, matching that behavior.
    const [feedback] = await db.update(feedbackTable)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(feedbackTable.id, params.feedbackId)).returning();

    return NextResponse.json({ feedback });
  } catch (error) {
    console.error("Error updating feedback:", error);
    return NextResponse.json(
      { error: "Failed to update status" },
      { status: 500 }
    );
  }

  } finally {
    await closeDb();
  }
}