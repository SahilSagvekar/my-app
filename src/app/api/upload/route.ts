// app/api/upload/route.ts

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { client as clientTable, file as fileTable, task as taskTable } from "@/lib/db/schema";
import { createId } from "@/lib/db/id";
import { eq, sql } from "drizzle-orm";
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
    const [client] = await db
      .select({
        rawFootageFolderId: clientTable.rawFootageFolderId,   // this is now an S3 prefix
        essentialsFolderId: clientTable.essentialsFolderId,   // also an S3 prefix
      })
      .from(clientTable)
      .where(eq(clientTable.id, clientId))
      .limit(1);

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
    // SAVE FILE RECORD TO DB
    // -------------------------------
    await db.insert(fileTable).values({
      id: createId(),
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
    });

    // -------------------------------
    // ADD LINK TO TASK.driveLinks
    // -------------------------------
    await db
      .update(taskTable)
      .set({
        driveLinks: sql`array_append(${taskTable.driveLinks}, ${uploaded.url})`, // rename this later to generic `fileLinks`
        updatedAt: new Date().toISOString(),
      })
      .where(eq(taskTable.id, taskId));

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
