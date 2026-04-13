// src/app/api/files/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

import { getCurrentUser2 } from '@/lib/auth';

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

async function getUser(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return null;
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: number; role: string };
    return decoded;
  } catch {
    return null;
  }
}

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

    // Check permission: admin, manager, or assigned editor
    const canDelete =
      user.role === "admin" ||
      user.role === "manager" ||
      file.task.assignedTo === user.id;

    if (!canDelete) {
      return NextResponse.json({ error: "Not authorized to delete this file" }, { status: 403 });
    }

    // Don't allow delete if task already in QC or beyond
    const lockedStatuses = ["QC_IN_PROGRESS", "COMPLETED", "POSTED", "SCHEDULED"];
    if (lockedStatuses.includes(file.task.status || "")) {
      return NextResponse.json(
        { error: "Cannot delete files from tasks in QC or completed" },
        { status: 400 }
      );
    }

    // Delete from R2 if s3Key exists
    if (file.s3Key) {
      try {
        await s3.send(
          new DeleteObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME!,
            Key: file.s3Key,
          })
        );
      } catch (s3Error) {
        console.error("R2 delete failed (continuing):", s3Error);
        // Continue even if R2 delete fails
      }
    }

    // Delete from database
    await prisma.file.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "File deleted" });
  } catch (error) {
    console.error("Delete file error:", error);
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 }
    );
  }
}