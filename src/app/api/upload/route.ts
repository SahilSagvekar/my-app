// app/api/upload/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadBufferToS3 } from "@/lib/s3";  // ⬅️ your S3 function

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const form = await req.formData();

    const file = form.get("file") as File | null;
    const taskId = form.get("taskId") as string | null;
    const clientId = form.get("clientId") as string | null;
    const folderType = form.get("folderType") as string | null;

    console.log("📥 FORM DATA RECEIVED:", {
      taskId,
      clientId,
      folderType,
      file: file ? file.name : null,
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
    console.error("❌ S3 Upload Error:", error);
    return NextResponse.json(
      { message: "Upload failed", error: error.message },
      { status: 500 }
    );
  }
}
