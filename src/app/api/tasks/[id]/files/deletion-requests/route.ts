// src/app/api/tasks/[id]/files/deletion-requests/route.ts
//
// Editor-facing half of the file-deletion-request feature.
// Converted to Drizzle (getDbHttp) for Cloudflare Workers edge runtime.

import { NextRequest, NextResponse } from "next/server";
import { getDbHttp } from "@/lib/db";
import { file as fileTable, fileDeletionRequest, user as userTable } from "@/lib/db/schema";
import { eq, inArray, and, desc } from "drizzle-orm";
import { getCurrentUser2 } from "@/lib/auth";
import { notifyUser } from "@/lib/notify";
import { createId } from "@/lib/db/id";
import crypto from "crypto";

const REVIEWER_ROLES = ["admin", "videographer"] as const;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = await params;
    const taskId = resolvedParams.id;
    const body = await request.json();
    const { fileIds, reason } = body as { fileIds?: string[]; reason?: string };

    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      return NextResponse.json({ error: "fileIds array is required" }, { status: 400 });
    }

    // Confirm every file actually belongs to this task
    const files = await db
      .select({ id: fileTable.id, name: fileTable.name })
      .from(fileTable)
      .where(and(inArray(fileTable.id, fileIds), eq(fileTable.taskId, taskId)));

    if (files.length === 0) {
      return NextResponse.json({ error: "No matching files found on this task" }, { status: 404 });
    }

    const batchId = crypto.randomUUID();

    const createdRows = [];
    for (const f of files) {
      const [row] = await db
        .insert(fileDeletionRequest)
        .values({
          id: createId(),
          fileId: f.id,
          taskId,
          requestedBy: user.id,
          reason: reason?.trim() || null,
          batchId,
          status: 'PENDING',
          createdAt: new Date().toISOString(),
        })
        .returning();
      createdRows.push(row);
    }

    // Notify reviewers (admin + videographer)
    try {
      const reviewers = await db
        .select({ id: userTable.id })
        .from(userTable)
        .where(inArray(userTable.role, ['admin', 'videographer']));

      const fileNames = files.map((f) => f.name).join(", ");
      await Promise.allSettled(
        reviewers.map((r) =>
          notifyUser({
            userId: r.id,
            type: "file_deletion_requested",
            title: `${user.name || "An editor"} requested file deletion`,
            body: files.length === 1
              ? `Requested deletion of "${fileNames}"`
              : `Requested deletion of ${files.length} files: ${fileNames}`,
            payload: { taskId, batchId, fileIds: files.map((f) => f.id) },
          })
        )
      );
    } catch (notifyError) {
      console.error("[deletion-requests] Failed to notify reviewers:", notifyError);
    }

    return NextResponse.json({ success: true, batchId, requests: createdRows });
  } catch (error: any) {
    console.error("[deletion-requests] POST error:", error);
    return NextResponse.json({ error: error.message || "Failed to create deletion request" }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = await params;
    const taskId = resolvedParams.id;
    const isReviewer = REVIEWER_ROLES.includes(user.role as any);

    const conditions = [eq(fileDeletionRequest.taskId, taskId)];
    if (!isReviewer) {
      conditions.push(eq(fileDeletionRequest.requestedBy, user.id));
    }

    const requests = await db
      .select({
        id: fileDeletionRequest.id,
        fileId: fileDeletionRequest.fileId,
        taskId: fileDeletionRequest.taskId,
        requestedBy: fileDeletionRequest.requestedBy,
        reason: fileDeletionRequest.reason,
        status: fileDeletionRequest.status,
        reviewedBy: fileDeletionRequest.reviewedBy,
        reviewedAt: fileDeletionRequest.reviewedAt,
        batchId: fileDeletionRequest.batchId,
        createdAt: fileDeletionRequest.createdAt,
        requesterName: userTable.name,
        requesterEmail: userTable.email,
      })
      .from(fileDeletionRequest)
      .leftJoin(userTable, eq(fileDeletionRequest.requestedBy, userTable.id))
      .where(and(...conditions))
      .orderBy(desc(fileDeletionRequest.createdAt));

    const hydrated = requests.map((r) => ({
      ...r,
      requester: r.requesterName || r.requesterEmail ? {
        id: r.requestedBy,
        name: r.requesterName,
        email: r.requesterEmail,
      } : null,
    }));

    return NextResponse.json({ requests: hydrated });
  } catch (error: any) {
    console.error("[deletion-requests] GET error:", error);
    return NextResponse.json({ error: error.message || "Failed to load deletion requests" }, { status: 500 });
  }
}