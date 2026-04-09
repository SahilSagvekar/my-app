export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
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

    let tasks;

    switch (role.toLowerCase()) {
      case "editor":
        tasks = await prisma.task.findMany({
          where: { assignedTo: userId },
          include: { client: true },
          orderBy: { updatedAt: "desc" },
        });
        break;

      case "qc_specialist":
        tasks = await prisma.task.findMany({
          where: { status: "READY_FOR_QC" },
          include: { client: true, user: true },
          orderBy: { updatedAt: "desc" },
        });
        break;

      case "videographer":
        tasks = await prisma.task.findMany({
          where: { taskType: "INGEST", assignedTo: userId },
          include: { client: true },
          orderBy: { updatedAt: "desc" },
        });
        break;

      case "scheduler":
        tasks = await prisma.task.findMany({
          where: { 
            OR: [
              { scheduler: userId },
              { scheduler: null }
            ],
            status: { in: ["COMPLETED", "SCHEDULED"] }
          },
          include: { client: true },
          orderBy: { updatedAt: "desc" },
        });
        break;

      case "client":
        tasks = await prisma.task.findMany({
          where: {
            status: 'CLIENT_REVIEW',
            // clientId: userId 
          },
          include: { user: true },
          orderBy: { updatedAt: "desc" },
        });
        break;

      case "manager":
      case "admin":
        tasks = await prisma.task.findMany({
          include: { client: true, user: true },
          orderBy: { createdAt: "desc" },
        });
        break;

      default:
        return NextResponse.json(
          { message: "Role not recognized" },
          { status: 400 }
        );
    }

    // ✅ Add signed URLs to files
    const tasksWithSignedUrls = tasks ? await Promise.all(
      tasks.map(async (task) => {
        const files = await prisma.file.findMany({
          where: { taskId: task.id, isActive: true },
        });

        if (files && files.length > 0) {
          const signedFiles = await addSignedUrlsToFiles(files);
          return { ...task, files: signedFiles };
        }
        return { ...task, files: [] };
      })
    ) : [];

    return NextResponse.json(tasksWithSignedUrls, { status: 200 });
  } catch (err: any) {
    console.error("❌ Fetch assigned tasks error:", err.message);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}