// app/api/upload/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadBufferToS3, deleteFileFromS3 } from "@/lib/s3";  // ⬅️ added deleteFileFromS3
import { getCurrentUser2 } from "@/lib/auth"; // ⬅️ added auth helper

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const form = await req.formData();

    const file = form.get("file") as File | null;
    const taskId = form.get("taskId") as string | null;
    const clientId = form.get("clientId") as string | null;
    const folderType = form.get("folderType") as string | null;
    const codec = form.get("codec") as string | null;

    console.log("📥 FORM DATA RECEIVED:", {
      taskId,
      clientId,
      folderType,
      file: file ? file.name : null,
      codec
    });
    // -------------------------------
    // VALIDATION
    // -------------------------------
    if (!file) {
      return NextResponse.json(
        { message: "A file is required" },
        { status: 400 }
      );
    }

    if (!taskId || !clientId || !folderType) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 }
      );
    }

    // -------------------------------
    // FETCH CLIENT FOLDERS
    // -------------------------------
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        rawFootageFolderId: true,   // this is now an S3 prefix
        essentialsFolderId: true,   // also an S3 prefix
      },
    });

    if (!client) {
      return NextResponse.json(
        { message: "Client not found" },
        { status: 404 }
      );
    }

    const targetPrefix =
      folderType === "rawFootage"
        ? client.rawFootageFolderId
        : client.essentialsFolderId;

    if (!targetPrefix) {
      return NextResponse.json(
        { message: `Missing S3 prefix for ${folderType}` },
        { status: 400 }
      );
    }

    // -------------------------------
    // UPLOAD → S3
    // -------------------------------
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log("⬆️ Uploading to S3...");

    const uploaded = await uploadBufferToS3({
      buffer,
      folderPrefix: targetPrefix, // now an S3 folder prefix
      filename: file.name,
      mimeType: file.type,
    });

    console.log("✅ UPLOADED TO S3:", uploaded);

    // -------------------------------
    // SAVE FILE RECORD TO PRISMA
    // -------------------------------
    await prisma.file.create({
      data: {
        taskId,
        name: file.name,
        url: uploaded.url, // S3 public URL
        mimeType: file.type,
        size: buffer.length,
        folderType: folderType === "rawFootage" ? "raw" : folderType, // Save the folder type
        s3Key: uploaded.key,
        codec: codec,
        version: 1,
        isActive: true,
      },
    });

    // -------------------------------
    // ADD LINK TO TASK.driveLinks
    // -------------------------------
    await prisma.task.update({
      where: { id: taskId },
      data: {
        driveLinks: { push: uploaded.url }, // rename this later to generic `fileLinks`
      },
    });

    return NextResponse.json(
      {
        message: "Uploaded successfully",
        url: uploaded.url,
        key: uploaded.key,
      },
      { status: 200 }
    );

  } catch (error: any) {
    return NextResponse.json(
      { message: "Upload failed", error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getCurrentUser2(req as any); 
    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const fileId = searchParams.get("fileId");

    if (!fileId) {
      return NextResponse.json({ message: "File ID is required" }, { status: 400 });
    }

    const fileRecord = await prisma.file.findUnique({
      where: { id: fileId },
      include: { task: true },
    });

    if (!fileRecord) {
      return NextResponse.json({ message: "File not found" }, { status: 404 });
    }

    // Role check
    const isOwner = fileRecord.uploadedBy === user.id;
    const isAssigned = fileRecord.task.assignedTo === user.id.toString();
    const isAdmin = user.role === "admin" || user.role === "manager";

    if (!isAdmin && !isOwner && !isAssigned) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    // 🔥 Check task status constraint
    if (fileRecord.task.status !== "IN_PROGRESS" && !isAdmin) {
      return NextResponse.json({
        message: "Can only delete files when task is IN_PROGRESS"
      }, { status: 400 });
    }

    // 1. Delete from S3
    if (fileRecord.s3Key) {
      try {
        await deleteFileFromS3(fileRecord.s3Key);
      } catch (s3Err) {
        console.warn("⚠️ S3 key not found or deletion failed, continuing...", s3Err);
      }
    }

    // 2. Remove from task.driveLinks
    const updatedDriveLinks = fileRecord.task.driveLinks.filter(link => link !== fileRecord.url);
    await prisma.task.update({
      where: { id: fileRecord.taskId },
      data: { driveLinks: updatedDriveLinks },
    });

    // 3. Delete from Prisma
    await prisma.file.delete({
      where: { id: fileId },
    });

    return NextResponse.json({ message: "Deleted successfully" });
  } catch (error: any) {
    console.error("❌ Deletion error:", error);
    return NextResponse.json({ message: "Deletion failed", error: error.message }, { status: 500 });
  }
}
