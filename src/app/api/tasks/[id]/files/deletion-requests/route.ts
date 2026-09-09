// src/app/api/tasks/[id]/files/deletion-requests/route.ts
//
// Editor-facing half of the file-deletion-request feature. Editors can't
// delete files directly (see DELETE /api/files/[id] — admin + videographer
// only); this is how they ask someone who can, for when they've uploaded
// the wrong file to a task.
//
// POST creates one FileDeletionRequest row per fileId, all sharing a
// batchId when more than one file is selected at once, so the reviewer can
// act on the whole batch together at PATCH /api/files/deletion-requests/[id].
// GET lists requests for this task — non-admin/videographer callers only
// see their own requests, so one editor can't see another's.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser2 } from "@/lib/auth";
import { notifyUser } from "@/lib/notify";
import crypto from "crypto";

const REVIEWER_ROLES = ["admin", "videographer"] as const;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser2(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: taskId } = await params;
    const body = await request.json();
    const { fileIds, reason } = body as { fileIds?: string[]; reason?: string };

    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      return NextResponse.json({ error: "fileIds array is required" }, { status: 400 });
    }

    // Confirm every file actually belongs to this task — prevents someone
    // from requesting deletion of a file on a task they don't have via a
    // crafted fileId.
    const files = await prisma.file.findMany({
      where: { id: { in: fileIds }, taskId },
      select: { id: true, name: true },
    });

    if (files.length === 0) {
      return NextResponse.json({ error: "No matching files found on this task" }, { status: 404 });
    }
    if (files.length < fileIds.length) {
      const foundIds = new Set(files.map((f) => f.id));
      const missing = fileIds.filter((fid) => !foundIds.has(fid));
      console.warn(`[deletion-requests] ${missing.length} fileId(s) not on task ${taskId}, skipping:`, missing);
    }

    // Group under one batchId even for a single file — keeps the reviewer
    // API uniform (it always reads/updates by batchId when present).
    const batchId = crypto.randomUUID();

    const created = await prisma.$transaction(
      files.map((f) =>
        prisma.fileDeletionRequest.create({
          data: {
            fileId: f.id,
            taskId,
            requestedBy: user.id,
            reason: reason?.trim() || null,
            batchId,
          },
        })
      )
    );

    // Notify everyone who can act on it — admin + videographer, by primary
    // role or by the secondary `roles` array (switch-role users).
    try {
      const reviewers = await prisma.user.findMany({
        where: {
          OR: [
            { role: { in: REVIEWER_ROLES as unknown as string[] } },
            { roles: { hasSome: REVIEWER_ROLES as unknown as string[] } },
          ],
        },
        select: { id: true },
      });

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
      // Never let a notification failure roll back a request that already saved.
      console.error("[deletion-requests] Failed to notify reviewers:", notifyError);
    }

    return NextResponse.json({ success: true, batchId, requests: created });
  } catch (error) {
    console.error("[deletion-requests] POST error:", error);
    return NextResponse.json({ error: "Failed to create deletion request" }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser2(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: taskId } = await params;
    const isReviewer = REVIEWER_ROLES.includes(user.role as any);

    const requests = await prisma.fileDeletionRequest.findMany({
      where: {
        taskId,
        // Non-reviewers (editors) only ever see their own requests.
        ...(isReviewer ? {} : { requestedBy: user.id }),
      },
      orderBy: { createdAt: "desc" },
    });

    const requesterIds = [...new Set(requests.map((r) => r.requestedBy))];
    const requesters = await prisma.user.findMany({
      where: { id: { in: requesterIds } },
      select: { id: true, name: true, email: true },
    });
    const requesterMap = new Map(requesters.map((r) => [r.id, r]));
    const hydrated = requests.map((r) => ({ ...r, requester: requesterMap.get(r.requestedBy) || null }));

    return NextResponse.json({ requests: hydrated });
  } catch (error) {
    console.error("[deletion-requests] GET error:", error);
    return NextResponse.json({ error: "Failed to load deletion requests" }, { status: 500 });
  }
}