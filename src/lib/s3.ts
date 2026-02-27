// src/lib/s3.ts

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
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
  expiresIn: number = 604800 // 7 days (maximum for SigV4 with IAM)
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });

  try {
    const signedUrl = await getSignedUrl(s3, command, { expiresIn });
    return signedUrl;
  } catch (error) {
    console.error('❌ Failed to generate signed URL:', error);
    throw error;
  }
}

export async function generateDownloadUrl(
  key: string,
  filename: string,
  expiresIn: number = 604800
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ResponseContentDisposition: `attachment; filename="${filename.replace(/"/g, '')}"`,
  });

  try {
    return await getSignedUrl(s3, command, { expiresIn });
  } catch (error) {
    console.error('❌ Failed to generate download URL:', error);
    throw error;
  }
}

// Add signed URLs to file objects
export async function addSignedUrlsToFiles(files: any[]): Promise<any[]> {
  if (!files || files.length === 0) return [];

  return Promise.all(
    files.map(async (file) => {
      try {
        // Check if it's an S3 URL or has an s3Key
        const isS3 = file.url?.includes('amazonaws.com') || !!file.s3Key;
        if (!isS3) return file;

        // 🔥 Use s3Key directly if available, otherwise extract from URL
        const s3Key = file.s3Key || extractS3KeyFromUrl(file.url);
        if (!s3Key) return file;

        // Sign the viewing URL only if it's not already signed
        let signedUrl = file.url;
        if (!file.url.includes('?X-Amz-Signature=')) {
          signedUrl = await generateSignedUrl(s3Key);
        }

        // ALWAYS generate a fresh download URL with the attachment header
        // This ensures the download feature works even for files previously signed
        const downloadUrl = await generateDownloadUrl(s3Key, file.name);

        return {
          ...file,
          url: signedUrl,
          downloadUrl: downloadUrl,
          originalUrl: file.url,
        };
      } catch (error) {
        console.error(`Failed to generate signed URL for file ${file.id}:`, error);
        return file;
      }
    })
  );
}

export async function deleteFileFromS3(key: string) {
  const s3 = getS3();
  try {
    await s3.send(
      new DeleteObjectCommand({
        Bucket: BUCKET,
        Key: key,
      })
    );
    console.log("✅ DELETED FROM S3:", key);
    return true;
  } catch (error) {
    console.error("❌ S3 Deletion Failed:", error);
    throw new Error("Failed to delete file from S3");
  }
}