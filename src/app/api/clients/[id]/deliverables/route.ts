export const dynamic = 'force-dynamic';
// app/api/clients/[clientId]/deliverables/route.ts
import { getDb } from "@/lib/db";
import { client as clientTable, monthlyDeliverable } from "@/lib/db/schema";
import { createId } from "@/lib/db/id";
import { eq, desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { syncPostingTargetsForClient } from "@/lib/posting-target-sync";

// POST - Create a new deliverable for a client
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { db, closeDb } = getDb();
  try {
  try {
    const { id: clientId } = await params;
    const data = await req.json();

    console.log("➕ Creating deliverable for client:", clientId);
    console.log("📦 Deliverable data:", data);

    // Verify client exists
    const [existingClient] = await db.select().from(clientTable).where(eq(clientTable.id, clientId)).limit(1);

    if (!existingClient) {
      return NextResponse.json({ message: "Client not found" }, { status: 404 });
    }

    const [deliverable] = await db.insert(monthlyDeliverable).values({
      id: createId(),
      clientId,
      type: data.type,
      quantity: data.quantity || 1,
      videosPerDay: data.videosPerDay || 1,
      postingSchedule: data.postingSchedule || "weekly",
      postingDays: data.postingDays || [],
      postingTimes: data.postingTimes || ["10:00 AM"],
      platforms: data.platforms || [],
      description: data.description || "",
      isTrial: data.isTrial ?? false,
      updatedAt: new Date().toISOString(),
    }).returning();

    console.log("✅ Deliverable created:", deliverable.id);

    await syncPostingTargetsForClient(clientId);

    return NextResponse.json({
      success: true,
      deliverable
    }, { status: 201 });

  } catch (err) {
    console.error("POST deliverable failed:", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }

  } finally {
    await closeDb();
  }
}

// GET - Get all deliverables for a client
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { db, closeDb } = getDb();
  try {
  try {
    const { id: clientId } = await params;

    const deliverables = await db.select().from(monthlyDeliverable)
      .where(eq(monthlyDeliverable.clientId, clientId))
      .orderBy(desc(monthlyDeliverable.createdAt));

    return NextResponse.json({ deliverables, monthlyDeliverables: deliverables });

  } catch (err) {
    console.error("GET deliverables failed:", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }

  } finally {
    await closeDb();
  }
}