// src/app/api/files/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

import { getCurrentUser2 } from '@/lib/auth';
import { deleteFileHard } from '@/lib/file-deletion';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser2(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Get file with task info
    const file = await prisma.file.findUnique({
      where: { id },
      include: {
        task: {
          select: {
            id: true,
            assignedTo: true,
            clientId: true,
            status: true,
          },
        },
      },
    });

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Check permission: admin and videographer (managers and editors cannot
    // delete directly — editors go through the request/approval flow at
    // POST /api/tasks/[id]/files/deletion-requests instead).
    const canDelete = user.role === "admin" || user.role === "videographer";

    if (!canDelete) {
      return NextResponse.json({ error: "Not authorized to delete this file" }, { status: 403 });
    }

    // Admins and videographers can delete regardless of task status
    // (QC/Completed/Posted/Scheduled included) — the lockedStatuses check
    // that used to block this for non-admins applied to a path that no
    // longer exists on this route.

    await deleteFileHard(id, { id: user.id, role: user.role });

    return NextResponse.json({ success: true, message: "File deleted" });
  } catch (error) {
    console.error("Delete file error:", error);
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 }
    );
  }
}