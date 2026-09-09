// src/app/api/files/deletion-requests/[id]/route.ts
//
// Admin/videographer decision on a single FileDeletionRequest. For a
// multi-file batch, the frontend loops over each request id in the batch
// and calls this once per id (same Promise.allSettled pattern already used
// for bulk task actions elsewhere in this app) rather than this route
// trying to guess which ids belong together.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser2 } from "@/lib/auth";
import { deleteFileHard } from "@/lib/file-deletion";
import { notifyUser } from "@/lib/notify";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser2(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role !== "admin" && user.role !== "videographer") {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const { id } = await params;
    const { action } = (await request.json()) as { action?: "approve" | "reject" };

    if (action !== "approve" && action !== "reject") {
      return NextResponse.json({ error: 'action must be "approve" or "reject"' }, { status: 400 });
    }

    const deletionRequest = await prisma.fileDeletionRequest.findUnique({ where: { id } });
    if (!deletionRequest) {
      return NextResponse.json({ error: "Deletion request not found" }, { status: 404 });
    }
    if (deletionRequest.status !== "PENDING") {
      return NextResponse.json(
        { error: `This request was already ${deletionRequest.status.toLowerCase()}` },
        { status: 409 }
      );
    }

    // Grab the file name for the notification before it's (possibly) deleted.
    const file = await prisma.file.findUnique({
      where: { id: deletionRequest.fileId },
      select: { name: true },
    });
    const fileName = file?.name || "the requested file";

    if (action === "approve") {
      // Someone may have already deleted this file directly (or approved a
      // duplicate request) between the request being made and reviewed —
      // deleteFileHard returns null in that case, which we still treat as
      // a successful approval since the end state (file gone) is what the
      // request wanted.
      await deleteFileHard(deletionRequest.fileId, { id: user.id, role: user.role });
    }

    const updated = await prisma.fileDeletionRequest.update({
      where: { id },
      data: {
        status: action === "approve" ? "APPROVED" : "REJECTED",
        reviewedBy: user.id,
        reviewedAt: new Date(),
      },
    });

    try {
      await notifyUser({
        userId: deletionRequest.requestedBy,
        type: action === "approve" ? "file_deletion_approved" : "file_deletion_rejected",
        title: action === "approve" ? "Deletion request approved" : "Deletion request rejected",
        body: action === "approve"
          ? `"${fileName}" was deleted.`
          : `Your request to delete "${fileName}" was declined.`,
        payload: { taskId: deletionRequest.taskId, fileId: deletionRequest.fileId },
      });
    } catch (notifyError) {
      console.error("[deletion-requests] Failed to notify requester of decision:", notifyError);
    }

    return NextResponse.json({ success: true, request: updated });
  } catch (error) {
    console.error("[deletion-requests] PATCH error:", error);
    return NextResponse.json({ error: "Failed to process deletion request" }, { status: 500 });
  }
}