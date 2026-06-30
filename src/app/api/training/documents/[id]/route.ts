export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser2 } from "@/lib/auth";
import { deleteFromS3 } from "@/lib/s3";

const ROLES_WITH_TRAINING = ["editor", "qc", "scheduler", "manager", "videographer", "sales", "admin"] as const;
type TrainingRole = (typeof ROLES_WITH_TRAINING)[number];

function isTrainingRole(r: string): r is TrainingRole {
  return ROLES_WITH_TRAINING.includes(r as TrainingRole);
}

// PATCH – update training document metadata (admin/manager only)
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
    const { title, description, order, role } = body;

    const updateData: { title?: string; description?: string; order?: number; role?: TrainingRole } = {};
    if (typeof title === "string" && title.trim()) updateData.title = title.trim();
    if (typeof description === "string") updateData.description = description.trim();
    if (typeof order === "number" && !isNaN(order)) updateData.order = order;
    if (role && isTrainingRole(role)) updateData.role = role;

    const document = await prisma.trainingDocument.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ document });
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e?.code === "P2025") {
      return NextResponse.json({ error: "Training document not found" }, { status: 404 });
    }
    console.error("PATCH /api/training/documents/[id] error:", err);
    return NextResponse.json({ error: "Failed to update training document" }, { status: 500 });
  }
}

// DELETE – remove training document (admin/manager only)
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

    const document = await prisma.trainingDocument.findUnique({ where: { id } });
    if (!document) {
      return NextResponse.json({ error: "Training document not found" }, { status: 404 });
    }

    await prisma.trainingDocument.delete({ where: { id } });

    // Best-effort cleanup of the actual R2 object — don't fail the request
    // if this errors, the DB record is already gone.
    deleteFromS3(document.s3Key).catch((err) =>
      console.error(`Failed to delete R2 object ${document.s3Key}:`, err)
    );

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e?.code === "P2025") {
      return NextResponse.json({ error: "Training document not found" }, { status: 404 });
    }
    console.error("DELETE /api/training/documents/[id] error:", err);
    return NextResponse.json({ error: "Failed to delete training document" }, { status: 500 });
  }
}