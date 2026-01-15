// src/lib/s3.ts

import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let _s3: S3Client | null = null;

export const s3 = new S3Client({
  region: process.env.AWS_S3_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export function getS3() {
  if (!_s3) {
    _s3 = new S3Client({
      region: process.env.AWS_S3_REGION!,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }
  return _s3;
}

const BUCKET = process.env.AWS_S3_BUCKET!;

// Create client folder structure
export async function createClientFolders(companyName: string) {
  const s3 = getS3();

  const mainPrefix = `${companyName}/`;
  const rawPrefix = `${companyName}/raw-footage/`;
  const elementsPrefix = `${companyName}/elements/`;
  const outputsPrefix = `${companyName}/outputs/`;

  const folderCommands = [
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: mainPrefix,
      ContentType: "application/x-directory",
    }),
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: rawPrefix,
      ContentType: "application/x-directory",
    }),
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: elementsPrefix,
      ContentType: "application/x-directory",
    }),
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: outputsPrefix,
      ContentType: "application/x-directory",
    }),
  ];

  await Promise.all(folderCommands.map((cmd) => s3.send(cmd)));

  return {
    mainFolderId: mainPrefix,
    rawFolderId: rawPrefix,
    elementsFolderId: elementsPrefix,
    outputsFolderId: outputsPrefix,
  };
}

// 🔥 Create month folder inside raw-footage
export async function createMonthFolder(companyName: string, monthYear: string) {
  const s3 = getS3();
  const monthPrefix = `${companyName}/raw-footage/${monthYear}/`;

  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: monthPrefix,
        ContentType: "application/x-directory",
      })
    );
    console.log('✅ Month folder created:', monthPrefix);
  } catch (error) {
    console.error('❌ Failed to create month folder:', error);
    // Don't throw - folder might already exist
  }

  return monthPrefix;
}

// 🔥 Create task output folder
export async function createTaskOutputFolder(
  companyName: string,
  taskId: string,
  taskTitle: string
) {
  const s3 = getS3();
  const sanitizedTitle = taskTitle.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
  const taskPrefix = `${companyName}/outputs/${taskId}-${sanitizedTitle}/`;

  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: taskPrefix,
        ContentType: "application/x-directory",
      })
    );
    console.log('✅ Task output folder created:', taskPrefix);
  } catch (error) {
    console.error('❌ Failed to create task folder:', error);
    // Don't throw - folder might already exist
  }

  return taskPrefix;
}

// Upload local file to S3
export async function uploadFileToS3(
  filePath: string,
  folderPrefix: string,
  fileName: string,
  mimeType: string
) {
  const s3 = getS3();

  if (!fs.existsSync(filePath)) {
    throw new Error("File does not exist: " + filePath);
  }

  const fileStream = fs.createReadStream(filePath);
  const Key = `${folderPrefix}${fileName}`;

  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key,
        Body: fileStream,
        ContentType: mimeType || "application/octet-stream",
      })
    );
  } catch (err) {
    console.error("❌ S3 Upload Failed:", err);
    throw new Error("S3 upload failed");
  } finally {
    fs.unlink(filePath, () => { });
  }

  return {
    key: Key,
    url: `https://${BUCKET}.s3.${process.env.AWS_S3_REGION}.amazonaws.com/${Key}`,
  };
}

// Upload buffer to S3
export async function uploadBufferToS3({
  buffer,
  folderPrefix,
  filename,
  mimeType,
}: {
  buffer: Buffer;
  folderPrefix: string;
  filename: string;
  mimeType: string;
}) {
  const s3 = getS3();
  const Key = `${folderPrefix}${filename}`;

  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key,
        Body: buffer,
        ContentType: mimeType || "application/octet-stream",
      })
    );
  } catch (err) {
    console.error("❌ Buffer Upload Failed:", err);
    throw new Error("Failed to upload buffer to S3");
  }

  return {
    key: Key,
    url: `https://${BUCKET}.s3.${process.env.AWS_S3_REGION}.amazonaws.com/${Key}`,
  };
}

// Extract S3 key from URL
// export function extractS3KeyFromUrl(s3Url: string): string | null {
//   if (!s3Url) return null;

//   try {
//     if (s3Url.startsWith("s3://")) {
//       const parts = s3Url.replace("s3://", "").split("/");
//       return parts.slice(1).join("/");
//     }

//     const url = new URL(s3Url);
//     const pathname = url.pathname;
//     return pathname.startsWith("/") ? pathname.substring(1) : pathname;
//   } catch (error) {
//     console.error("Error extracting S3 key:", error);
//     return null;
//   }
// }

export function extractS3KeyFromUrl(s3Url: string): string | null {
  if (!s3Url) return null;

  try {
    if (s3Url.startsWith("s3://")) {
      const parts = s3Url.replace("s3://", "").split("/");
      return parts.slice(1).join("/");
    }

    const url = new URL(s3Url);
    let pathname = url.pathname;
    
    // Remove leading slash
    pathname = pathname.startsWith("/") ? pathname.substring(1) : pathname;
    
    // 🔥 Decode URL encoding (critical for files with spaces, #, etc.)
    pathname = decodeURIComponent(pathname);
    
    return pathname;
  } catch (error) {
    console.error("Error extracting S3 key:", error);
    return null;
  }
}

// Generate pre-signed URL
// export async function generateSignedUrl(
//   key: string,
//   expiresIn: number = 7200 // 2 hours default
// ): Promise<string> {
//   const command = new GetObjectCommand({
//     Bucket: BUCKET,
//     Key: key,
//   });

//   const signedUrl = await getSignedUrl(s3, command, { expiresIn });
//   return signedUrl;
// }


export async function generateSignedUrl(
  key: string,
  expiresIn: number = 7200
): Promise<string> {
  console.log('🔍 Generating signed URL for key:', key);
  console.log('🔍 Bucket:', BUCKET);
  
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });

  try {
    const signedUrl = await getSignedUrl(s3, command, { expiresIn });
    console.log('✅ Signed URL generated successfully');
    return signedUrl;
  } catch (error) {
    console.error('❌ Failed to generate signed URL:', error);
    throw error;
  }
}

// Add signed URLs to file objects
export async function addSignedUrlsToFiles(files: any[]): Promise<any[]> {
  if (!files || files.length === 0) return [];

  return Promise.all(
    files.map(async (file) => {
      try {
        // 🔥 Use s3Key directly if available, otherwise extract from URL
        const s3Key = file.s3Key || extractS3KeyFromUrl(file.url);
        if (!s3Key) return file;

        const signedUrl = await generateSignedUrl(s3Key);
        return {
          ...file,
          url: signedUrl,
          originalUrl: file.url,
        };
      } catch (error) {
        console.error(`Failed to generate signed URL for file ${file.id}:`, error);
        return file;
      }
    })
  );
}