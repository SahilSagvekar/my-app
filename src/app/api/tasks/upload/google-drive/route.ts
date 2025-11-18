import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadBufferToDrive } from "@/lib/googleDrive";

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
      console.error("❌ No file received");
      return NextResponse.json(
        { message: "At least one file is required" },
        { status: 400 }
      );
    }

    if (!taskId) {
      return NextResponse.json(
        { message: "taskId is required" },
        { status: 400 }
      );
    }

    if (!clientId) {
      return NextResponse.json(
        { message: "clientId is required" },
        { status: 400 }
      );
    }

    if (!folderType) {
      return NextResponse.json(
        { message: "folderType is required" },
        { status: 400 }
      );
    }

    // -------------------------------
    // FETCH CLIENT FOLDER
    // -------------------------------
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        rawFootageFolderId: true,
        essentialsFolderId: true,
      },
    });

    if (!client) {
      return NextResponse.json(
        { message: "Client not found" },
        { status: 404 }
      );
    }

    const targetFolder =
      folderType === "rawFootage"
        ? client.rawFootageFolderId
        : client.essentialsFolderId;

    if (!targetFolder) {
      return NextResponse.json(
        { message: `Folder ID missing for ${folderType}` },
        { status: 400 }
      );
    }

    // -------------------------------
    // UPLOAD FILE → GOOGLE DRIVE
    // -------------------------------
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log("⬆️ Uploading to Drive...");

    const uploaded = await uploadBufferToDrive({
      buffer,
      filename: file.name,
      folderId: targetFolder,
      mimeType: file.type,
    });

    console.log("✅ UPLOADED:", uploaded);

    // -------------------------------
    // SAVE FILE LINK INSIDE TASK
    // -------------------------------
    await prisma.task.update({
      where: { id: taskId },
      data: {
        driveLinks: {
          push: uploaded.webViewLink || "",
        },
      },
    });

    return NextResponse.json(
      {
        message: "Uploaded successfully",
        driveFileId: uploaded.id,
        webViewLink: uploaded.webViewLink,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("❌ Google Drive Upload Error:", error);
    return NextResponse.json(
      { message: "Upload failed", error: error.message },
      { status: 500 }
    );
  }
}
