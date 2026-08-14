export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { client as clientTable, brandAsset } from "@/lib/db/schema";
import { createId } from "@/lib/db/id";
import { eq } from "drizzle-orm";
import { uploadBufferToS3 } from "@/lib/s3";

export async function POST(req: Request) {
  const { db, closeDb } = getDb();
  try {
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
    const [client] = await db.select().from(clientTable).where(eq(clientTable.id, clientId)).limit(1);
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
    const [asset] = await db.insert(brandAsset).values({
      id: createId(),
      clientId,
      name: file.name.split(".")[0],
      type: file.type.includes("image") ? "logo" : "other",
      fileUrl: s3Upload.url,
      fileName: file.name,
      fileSize: `${Math.round(file.size / 1024)} KB`,
      uploadedAt: new Date().toISOString(),
      uploadedBy: "System",
    }).returning();

    return NextResponse.json({ asset });

  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  } finally {
    await closeDb();
  }
}
