// src/app/api/files/deletion-requests/[id]/route.ts
//
// Admin/videographer decision on a single FileDeletionRequest.
// Converted to Drizzle (getDbHttp) for Cloudflare Workers edge runtime.

import { NextRequest, NextResponse } from "next/server";
import { getDbHttp } from "@/lib/db";
import { file as fileTable, fileDeletionRequest } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser2 } from "@/lib/auth";
import { deleteFileHard } from "@/lib/file-deletion";
import { notifyUser } from "@/lib/notify";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role !== "admin" && user.role !== "videographer") {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const resolvedParams = await params;
    const id = resolvedParams.id;
    const { action } = (await request.json()) as { action?: "approve" | "reject" };

    if (action !== "approve" && action !== "reject") {
      return NextResponse.json({ error: 'action must be "approve" or "reject"' }, { status: 400 });
    }

    const [deletionRequest] = await db
      .select()
      .from(fileDeletionRequest)
      .where(eq(fileDeletionRequest.id, id))
      .limit(1);

    if (!deletionRequest) {
      return NextResponse.json({ error: "Deletion request not found" }, { status: 404 });
    }
    if (deletionRequest.status !== "PENDING") {
      return NextResponse.json(
        { error: `This request was already ${deletionRequest.status.toLowerCase()}` },
        { status: 409 }
      );
    }

    // Grab the file name for the notification before it's (possibly) deleted
    const [file] = await db
      .select({ name: fileTable.name })
      .from(fileTable)
      .where(eq(fileTable.id, deletionRequest.fileId))
      .limit(1);

    const fileName = file?.name || "the requested file";

    if (action === "approve") {
      await deleteFileHard(deletionRequest.fileId, { id: user.id, role: user.role });
    }

    const [updated] = await db
      .update(fileDeletionRequest)
      .set({
        status: action === "approve" ? "APPROVED" : "REJECTED",
        reviewedBy: user.id,
        reviewedAt: new Date().toISOString(),
      })
      .where(eq(fileDeletionRequest.id, id))
      .returning();

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
  } catch (error: any) {
    console.error("[deletion-requests] PATCH error:", error);
    return NextResponse.json({ error: error.message || "Failed to process deletion request" }, { status: 500 });
  }
}