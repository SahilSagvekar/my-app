import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser2 } from "@/lib/auth";

const ROLES_WITH_TRAINING = ["editor", "qc", "scheduler", "manager", "videographer", "sales", "admin"] as const;
type TrainingRole = (typeof ROLES_WITH_TRAINING)[number];

function isTrainingRole(r: string): r is TrainingRole {
  return ROLES_WITH_TRAINING.includes(r as TrainingRole);
}

// PATCH – update training course (admin/manager only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role !== "admin" && user.role !== "manager") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { title, description, order, role } = body as {
      title?: string;
      description?: string;
      order?: number;
      role?: string;
    };

    const updateData: { title?: string; description?: string; order?: number; role?: TrainingRole } = {};

    if (typeof title === "string" && title.trim()) updateData.title = title.trim();
    if (typeof description === "string") updateData.description = description.trim();
    if (typeof order === "number" && !isNaN(order)) updateData.order = order;
    if (role && isTrainingRole(role)) updateData.role = role;

    const course = await prisma.trainingCourse.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ course });
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e?.code === "P2025") {
      return NextResponse.json({ error: "Training course not found" }, { status: 404 });
    }
    console.error("PATCH /api/training/courses/[id] error:", err);
    return NextResponse.json({ error: "Failed to update training course" }, { status: 500 });
  }
}

// DELETE – remove training course (admin/manager only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role !== "admin" && user.role !== "manager") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Optionally, you might want to delete videos or reassign them.
    // For now, just delete the course; videos will have courseId set to null.
    await prisma.trainingCourse.delete({
      where: { id },
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e?.code === "P2025") {
      return NextResponse.json({ error: "Training course not found" }, { status: 404 });
    }
    console.error("DELETE /api/training/courses/[id] error:", err);
    return NextResponse.json({ error: "Failed to delete training course" }, { status: 500 });
  }
}

