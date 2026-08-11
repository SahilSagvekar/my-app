export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { task, file as fileTable } from "@/lib/db/schema";
import { and, or, eq, isNull, inArray, desc } from "drizzle-orm";
import jwt from "jsonwebtoken";

function getTokenFromCookies(req: Request) {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/authToken=([^;]+)/);
  return match ? match[1] : null;
}

import { getCurrentUser2 } from "@/lib/auth";
import { addSignedUrlsToFiles } from "@/lib/s3";

export async function GET(req: any) {
  try {
    const user = await getCurrentUser2(req);
    if (!user)
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const userId = user.id;
    const role = user.role || "";

    let rawTasks;

    switch (role.toLowerCase()) {
      case "editor":
        rawTasks = await db.query.task.findMany({
          where: eq(task.assignedTo, userId),
          with: { client: true },
          orderBy: desc(task.updatedAt),
        });
        break;

      case "qc_specialist":
        rawTasks = await db.query.task.findMany({
          where: eq(task.status, "READY_FOR_QC"),
          with: { client: true, user_assignedTo: true },
          orderBy: desc(task.updatedAt),
        });
        break;

      case "videographer":
        rawTasks = await db.query.task.findMany({
          where: and(eq(task.taskType, "INGEST"), eq(task.assignedTo, userId)),
          with: { client: true },
          orderBy: desc(task.updatedAt),
        });
        break;

      case "scheduler":
        rawTasks = await db.query.task.findMany({
          where: and(
            or(eq(task.scheduler, userId), isNull(task.scheduler)),
            inArray(task.status, ["COMPLETED", "SCHEDULED"])
          ),
          with: { client: true },
          orderBy: desc(task.updatedAt),
        });
        break;

      case "client":
        rawTasks = await db.query.task.findMany({
          where: eq(task.status, 'CLIENT_REVIEW'),
          with: { user_assignedTo: true },
          orderBy: desc(task.updatedAt),
        });
        break;

      case "manager":
      case "admin":
        rawTasks = await db.query.task.findMany({
          with: { client: true, user_assignedTo: true },
          orderBy: desc(task.createdAt),
        });
        break;

      default:
        return NextResponse.json(
          { message: "Role not recognized" },
          { status: 400 }
        );
    }

    const tasks = (rawTasks ?? []).map((t: any) => {
      const { user_assignedTo, ...rest } = t;
      return "user_assignedTo" in t ? { ...rest, user: user_assignedTo } : rest;
    });

    // ✅ Add signed URLs to files
    const tasksWithSignedUrls = tasks ? await Promise.all(
      tasks.map(async (t: any) => {
        const taskFiles = await db.select().from(fileTable)
          .where(and(eq(fileTable.taskId, t.id), eq(fileTable.isActive, true)));

        if (taskFiles && taskFiles.length > 0) {
          const signedFiles = await addSignedUrlsToFiles(taskFiles);
          return { ...t, files: signedFiles };
        }
        return { ...t, files: [] };
      })
    ) : [];

    return NextResponse.json(tasksWithSignedUrls, { status: 200 });
  } catch (err: any) {
    console.error("❌ Fetch assigned tasks error:", err.message);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}