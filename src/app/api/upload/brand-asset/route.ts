import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadBufferToS3 } from "@/lib/s3";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File;
    const clientId = form.get("clientId") as string;
    const folder = form.get("folder") as string; // "elements" | "raw-footage"

    if (!file || !clientId)
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Get client name for folder path
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client)
      return NextResponse.json({ error: "Client not found" }, { status: 404 });

    let prefix = "";
    if (folder === "elements") prefix = client.essentialsFolderId;
    else prefix = client.rawFootageFolderId;

    // Upload to S3
    const s3Upload = await uploadBufferToS3({
      buffer,
      folderPrefix: prefix,
      filename: file.name,
      mimeType: file.type,
    });

    // Save asset in DB
    const asset = await prisma.brandAsset.create({
      data: {
        clientId,
        name: file.name.split(".")[0],
        type: file.type.includes("image") ? "logo" : "other",
        fileUrl: s3Upload.url,
        fileName: file.name,
        fileSize: `${Math.round(file.size / 1024)} KB`,
        uploadedBy: "System",
      },
    });

    return NextResponse.json({ asset });

  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
