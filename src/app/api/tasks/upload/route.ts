import { NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: process.env.AWS_S3_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

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

    const bucket = process.env.AWS_S3_BUCKET!;
    const fileName = `${Date.now()}-${file.name}`;
    const key = `${folder ?? "uploads"}/${fileName}`;

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: file.type,
        ACL: "public-read", // make file accessible
      })
    );

    const url = `https://${bucket}.s3.${process.env.AWS_S3_REGION}.amazonaws.com/${key}`;

    return NextResponse.json({ url, key });
  } catch (err: any) {
    console.error("S3 Upload Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
