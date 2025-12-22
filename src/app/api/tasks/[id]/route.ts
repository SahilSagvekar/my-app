// app/api/tasks/[taskId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { addSignedUrlsToFiles } from "@/lib/s3";

export async function GET(
  request: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    const { taskId } = params;

    if (!taskId) {
      return NextResponse.json(
        { error: "Task ID is required" },
        { status: 400 }
      );
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        files: {
          select: {
            id: true,
            name: true,
            url: true,
            mimeType: true,
            size: true,
            uploadedAt: true,
          },
          orderBy: {
            uploadedAt: "desc",
          },
        },
        assignedToUser: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
        client: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!task) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      );
    }

    // Add signed URLs to files for secure access
    const filesWithSignedUrls = await addSignedUrlsToFiles(task.files);

    return NextResponse.json({
      ...task,
      files: filesWithSignedUrls,
    });
  } catch (error: any) {
    console.error("Error fetching task:", error);
    return NextResponse.json(
      { error: "Failed to fetch task", message: error.message },
      { status: 500 }
    );
  }
}