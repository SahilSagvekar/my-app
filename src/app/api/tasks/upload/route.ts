export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getS3, BUCKET, getFileUrl } from "@/lib/s3";

const s3 = getS3();

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const folder = formData.get("folder") as string | null; // "raw-footage", "essentials", etc.

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const fileName = `${Date.now()}-${file.name}`;
    const key = `${folder ?? "uploads"}/${fileName}`;

    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: buffer,
        ContentType: file.type,
      })
    );

    const url = getFileUrl(key);

    return NextResponse.json({ url, key });
  } catch (err: any) {
    console.error("S3 Upload Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
