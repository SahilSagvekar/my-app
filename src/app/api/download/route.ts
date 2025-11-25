import { NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3 } from "@/lib/s3";

export async function POST(req: Request) {
  const { key, filename } = await req.json();

  console.log("Generating signed URL for key:", key, "with filename:", filename);
  
  if (!key) {
    return NextResponse.json({ error: "Missing S3 key" }, { status: 400 });
  }

  const command = new GetObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET!,
    Key: key,
    ResponseContentDisposition: `attachment; filename="${filename}"`,
  });

  const url = await getSignedUrl(s3, command, { expiresIn: 60 });

  return NextResponse.json({ url });
}
