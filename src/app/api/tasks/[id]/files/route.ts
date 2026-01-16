// app/api/tasks/[id]/files/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({
  region: process.env.AWS_S3_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

async function generateSignedUrl(s3Key: string): Promise<string> {
  // 🔥 Decode URL-encoded characters if present
  const decodedKey = decodeURIComponent(s3Key);
  
  console.log("🔑 Generating signed URL for:", {
    originalKey: s3Key,
    decodedKey: decodedKey,
    bucket: process.env.AWS_S3_BUCKET,
  });

  const command = new GetObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET!,
    Key: decodedKey,
  });
  
  const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 7200 });
  console.log("✅ Signed URL generated:", signedUrl.substring(0, 100) + "...");
  
  return signedUrl;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;
    
    const files = await prisma.file.findMany({
      where: { taskId: id },
      orderBy: [
        { folderType: 'asc' },
        { version: 'desc' },
      ],
    });

    console.log("📁 Found files:", files.map(f => ({ 
      id: f.id, 
      name: f.name, 
      s3Key: f.s3Key,
      url: f.url 
    })));

    const filesWithSignedUrls = await Promise.all(
      files.map(async (file) => {
        let signedUrl = file.url;
        
        if (file.s3Key) {
          try {
            signedUrl = await generateSignedUrl(file.s3Key);
          } catch (err) {
            console.error(`❌ Failed to sign URL for ${file.s3Key}:`, err);
          }
        } else {
          console.warn(`⚠️ No s3Key for file ${file.id}, using original URL`);
        }
        
        return {
          id: file.id,
          name: file.name,
          url: signedUrl,
          size: Number(file.size),
          mimeType: file.mimeType,
          version: file.version,
          isActive: file.isActive,
          folderType: file.folderType,
          createdAt: file.createdAt,
          replacedAt: file.replacedAt,
        };
      })
    );

    return NextResponse.json({ files: filesWithSignedUrls });
  } catch (error: any) {
    console.error("❌ Error fetching task files:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}