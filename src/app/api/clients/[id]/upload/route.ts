import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadBufferToS3 } from "@/lib/s3";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const formData = await req.formData();

    const file = formData.get("file") as File;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const uploaded = await uploadBufferToS3({
      buffer,
      folderPrefix: `${id}/brand-assets/`,
      filename: file.name,
      mimeType: file.type,
    });

    const asset = await prisma.brandAsset.create({
      data: {
        clientId: id,
        name: file.name.split(".")[0],
        type: file.type.includes("image")
          ? "logo"
          : "other",
        fileUrl: uploaded.url,
        fileName: file.name,
        fileSize: `${Math.round(file.size / 1024)} KB`,
        uploadedAt: new Date(),
        uploadedBy: "System",
      },
    });

    return NextResponse.json({ success: true, asset });
  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
