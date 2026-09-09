// src/app/api/files/deletion-requests/route.ts
//
// Admin/videographer-facing queue: every pending file-deletion request
// across all tasks, for a dashboard-wide "Deletion Requests" list rather
// than having to open each task individually. Defaults to PENDING only;
// pass ?status=all to see resolved ones too.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser2 } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser2(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role !== "admin" && user.role !== "videographer") {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const requests = await prisma.fileDeletionRequest.findMany({
      where: status && status !== "all" ? { status: status.toUpperCase() as any } : { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    // Hydrate with file/task/requester display info in a couple of batched
    // queries rather than a relation join, since FileDeletionRequest
    // deliberately has no @relation FKs (see schema comment).
    const fileIds = [...new Set(requests.map((r) => r.fileId))];
    const taskIds = [...new Set(requests.map((r) => r.taskId))];
    const requesterIds = [...new Set(requests.map((r) => r.requestedBy))];

    const [files, tasks, requesters] = await Promise.all([
      prisma.file.findMany({ where: { id: { in: fileIds } }, select: { id: true, name: true, s3Key: true } }),
      prisma.task.findMany({ where: { id: { in: taskIds } }, select: { id: true, title: true } }),
      prisma.user.findMany({ where: { id: { in: requesterIds } }, select: { id: true, name: true, email: true } }),
    ]);

    const fileMap = new Map(files.map((f) => [f.id, f]));
    const taskMap = new Map(tasks.map((t) => [t.id, t]));
    const requesterMap = new Map(requesters.map((r) => [r.id, r]));

    const hydrated = requests.map((r) => ({
      ...r,
      file: fileMap.get(r.fileId) || null,
      task: taskMap.get(r.taskId) || null,
      requester: requesterMap.get(r.requestedBy) || null,
    }));

    return NextResponse.json({ requests: hydrated });
  } catch (error) {
    console.error("[deletion-requests] Global GET error:", error);
    return NextResponse.json({ error: "Failed to load deletion requests" }, { status: 500 });
  }
}