export const dynamic = 'force-dynamic';
// app/api/tasks/[id]/files/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDbHttp } from "@/lib/db";
import { file as fileTable, user as userTable } from "@/lib/db/schema";
import { eq, asc, desc } from "drizzle-orm";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getS3, BUCKET } from "@/lib/s3";

const s3Client = getS3();

async function generateSignedUrl(s3Key: string): Promise<string> {
  // 🔥 Decode URL-encoded characters if present
  const decodedKey = decodeURIComponent(s3Key);
  
  console.log("🔑 Generating signed URL for:", {
    originalKey: s3Key,
    decodedKey: decodedKey,
    bucket: BUCKET,
  });

  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: decodedKey,
  });
  
  const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 86400 });
  console.log("✅ Signed URL generated:", signedUrl.substring(0, 100) + "...");
  
  return signedUrl;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const db = getDbHttp();
  try {
    const resolvedParams = await params;
    const id = resolvedParams.id;
    
    const files = await db
      .select({
        id: fileTable.id,
        name: fileTable.name,
        url: fileTable.url,
        s3Key: fileTable.s3Key,
        mimeType: fileTable.mimeType,
        size: fileTable.size,
        version: fileTable.version,
        isActive: fileTable.isActive,
        folderType: fileTable.folderType,
        createdAt: fileTable.createdAt,
        uploadedAt: fileTable.uploadedAt,
        replacedAt: fileTable.replacedAt,
        uploadedBy: fileTable.uploadedBy,
        uploaderName: userTable.name,
        uploaderRole: userTable.role,
      })
      .from(fileTable)
      .leftJoin(userTable, eq(fileTable.uploadedBy, userTable.id))
      .where(eq(fileTable.taskId, id))
      .orderBy(asc(fileTable.folderType), desc(fileTable.version), desc(fileTable.createdAt));

    console.log("📁 Found files:", files.map(f => ({ 
      id: f.id, 
      name: f.name, 
      s3Key: f.s3Key,
      url: f.url,
      isActive: f.isActive,
      version: f.version,
      folderType: f.folderType,
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
          uploadedAt: file.uploadedAt,
          replacedAt: file.replacedAt,
          uploader: file.uploaderName ? {
            name: file.uploaderName,
            role: file.uploaderRole,
          } : null,
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