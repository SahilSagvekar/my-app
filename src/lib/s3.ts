// lib/s3.ts
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";

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

// -------------------------
// Create Folder Structure
// -------------------------
export async function createClientFolders(clientName: string) {
  const s3 = getS3();

  const mainPrefix = `${clientName}/`;
  const rawPrefix = `${clientName}/raw-footage/`;
  const essentialsPrefix = `${clientName}/essentials/`;

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
      Key: essentialsPrefix,
      ContentType: "application/x-directory",
    }),
  ];

  await Promise.all(folderCommands.map((cmd) => s3.send(cmd)));

  return {
    mainFolderId: mainPrefix,
    rawFolderId: rawPrefix,
    essentialsFolderId: essentialsPrefix,
  };
}

// -------------------------
// Upload Local File
// -------------------------
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
    fs.unlink(filePath, () => {});
  }

  return {
    key: Key,
    url: `https://${BUCKET}.s3.${process.env.AWS_S3_REGION}.amazonaws.com/${Key}`,
  };
}

// -------------------------
// Upload Buffer
// -------------------------
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
