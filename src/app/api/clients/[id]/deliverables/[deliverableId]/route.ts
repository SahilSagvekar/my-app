// app/api/clients/[clientId]/deliverables/[deliverableId]/route.ts
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET - Get a single deliverable
export async function GET(
  req: Request,
  { params }: { params: Promise<{ clientId: string; deliverableId: string }> }
) {
  try {
    const { clientId, deliverableId } = await params;

    const deliverable = await prisma.monthlyDeliverable.findFirst({
      where: {
        id: deliverableId,
        clientId: clientId,
      },
    });

    if (!deliverable) {
      return NextResponse.json({ message: "Deliverable not found" }, { status: 404 });
    }

    return NextResponse.json({ deliverable });

  } catch (err) {
    console.error("GET deliverable failed:", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}

// PUT - Update a deliverable
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ clientId: string; deliverableId: string }> }
) {
  try {
    const { clientId, deliverableId } = await params;
    const data = await req.json();

    console.log("✏️ Updating deliverable:", deliverableId);
    console.log("📦 Update data:", data);

    // Verify deliverable exists and belongs to this client
    const existing = await prisma.monthlyDeliverable.findFirst({
      where: {
        id: deliverableId,
        clientId: clientId,
      },
    });

    if (!existing) {
      return NextResponse.json({ message: "Deliverable not found" }, { status: 404 });
    }

    const deliverable = await prisma.monthlyDeliverable.update({
      where: { id: deliverableId },
      data: {
        type: data.type,
        quantity: data.quantity || 1,
        videosPerDay: data.videosPerDay || 1,
        postingSchedule: data.postingSchedule || "weekly",
        postingDays: data.postingDays || [],
        postingTimes: data.postingTimes || ["10:00"],
        platforms: data.platforms || [],
        description: data.description || "",
      },
    });

    console.log("✅ Deliverable updated:", deliverable.id);

    return NextResponse.json({
      success: true,
      deliverable
    });

  } catch (err) {
    console.error("PUT deliverable failed:", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}

// DELETE - Delete a deliverable
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ clientId: string; deliverableId: string }> }
) {
  try {
    const { clientId, deliverableId } = await params;

    console.log("🗑️ Deleting deliverable:", deliverableId);

    // Verify deliverable exists and belongs to this client
    const existing = await prisma.monthlyDeliverable.findFirst({
      where: {
        id: deliverableId,
        clientId: clientId,
      },
    });

    if (!existing) {
      return NextResponse.json({ message: "Deliverable not found" }, { status: 404 });
    }

    // Deactivate related recurring tasks (don't delete for data safety)
    await prisma.recurringTask.updateMany({
      where: { deliverableId },
      data: { active: false },
    });

    // Delete the deliverable
    await prisma.monthlyDeliverable.delete({
      where: { id: deliverableId },
    });

    console.log("✅ Deliverable deleted:", deliverableId);

    return NextResponse.json({
      success: true,
      message: "Deliverable deleted successfully"
    });

  } catch (err) {
    console.error("DELETE deliverable failed:", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}