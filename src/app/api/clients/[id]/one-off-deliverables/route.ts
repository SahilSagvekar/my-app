export const dynamic = 'force-dynamic';
import { db } from "@/lib/db";
import { client, oneOffDeliverable } from "@/lib/db/schema";
import { createId } from "@/lib/db/id";
import { eq, desc } from "drizzle-orm";
import { NextResponse } from "next/server";

// POST - Create a new one-off deliverable for a client
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await params;
    const data = await req.json();

    console.log("➕ Creating one-off deliverable for client:", clientId);

    // Verify client exists
    const [existingClient] = await db.select().from(client).where(eq(client.id, clientId)).limit(1);

    if (!existingClient) {
      return NextResponse.json({ message: "Client not found" }, { status: 404 });
    }

    const [deliverable] = await db.insert(oneOffDeliverable).values({
      id: createId(),
      clientId,
      type: data.type,
      quantity: data.quantity || 1,
      videosPerDay: data.videosPerDay || 1,
      postingSchedule: data.postingSchedule || "one-off",
      postingDays: data.postingDays || [],
      postingTimes: data.postingTimes || ["10:00 AM"],
      platforms: data.platforms || [],
      description: data.description || "",
      status: "PENDING",
      updatedAt: new Date().toISOString(),
    }).returning();

    console.log("✅ One-off deliverable created:", deliverable.id);

    return NextResponse.json({
      success: true,
      deliverable
    }, { status: 201 });

  } catch (err) {
    console.error("POST one-off deliverable failed:", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}

// GET - Get all one-off deliverables for a client
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await params;

    const deliverables = await db.select().from(oneOffDeliverable)
      .where(eq(oneOffDeliverable.clientId, clientId))
      .orderBy(desc(oneOffDeliverable.createdAt));

    return NextResponse.json({ deliverables, oneOffDeliverables: deliverables });

  } catch (err) {
    console.error("GET one-off deliverables failed:", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
