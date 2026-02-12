import { prisma } from "@/lib/prisma";
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
    const client = await prisma.client.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      return NextResponse.json({ message: "Client not found" }, { status: 404 });
    }

    const deliverable = await prisma.oneOffDeliverable.create({
      data: {
        clientId,
        type: data.type,
        quantity: data.quantity || 1,
        videosPerDay: data.videosPerDay || 1,
        postingSchedule: data.postingSchedule || "one-off",
        postingDays: data.postingDays || [],
        postingTimes: data.postingTimes || ["10:00"],
        platforms: data.platforms || [],
        description: data.description || "",
        status: "PENDING",
      },
    });

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

    const deliverables = await prisma.oneOffDeliverable.findMany({
      where: { clientId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ deliverables });

  } catch (err) {
    console.error("GET one-off deliverables failed:", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
