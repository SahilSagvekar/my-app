import { google } from "googleapis";
import fs from "fs";
import path from "path";
import { Readable } from "stream";

// ─── Service account auth (for folder operations, metadata) ───
function getServiceAccountKey(): string {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || "";
  return raw.replace(/\\n/g, "\n");
}

const serviceAccountAuth = new google.auth.JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: getServiceAccountKey(),
  scopes: ["https://www.googleapis.com/auth/drive"],
});

// ─── OAuth2 auth (for file uploads — uses personal quota) ───
function getOAuthClient() {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/oauth2callback"
  );
  client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });
  return client;
}

// ─── Drive instances ───
const drive = google.drive({ version: "v3", auth: serviceAccountAuth });

function getOAuthDrive() {
  return google.drive({ version: "v3", auth: getOAuthClient() });
}

// ✅ Extract Drive file ID from a Drive URL
export function extractGoogleDriveFileId(url: string): string | null {
  const patterns = [
    /drive\.google\.com\/file\/d\/([^\/\?]+)/,
    /drive\.google\.com\/open\?id=([^&]+)/,
    /drive\.google\.com\/uc\?id=([^&]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// ✅ Delete a file from Drive by file ID (called after client approves)
export async function deleteFileFromDrive(driveFileId: string): Promise<void> {
  try {
    const oauthDrive = getOAuthDrive();
    await oauthDrive.files.delete({ fileId: driveFileId });
    console.log(`🗑️ Drive file deleted: ${driveFileId}`);
  } catch (err: any) {
    console.error(`⚠️ Failed to delete Drive file ${driveFileId}:`, err.message || err);
  }
}

// ✅ Get or create a review folder for a client
export async function getOrCreateReviewFolder(clientName: string): Promise<string> {
  const parentId = process.env.GOOGLE_DRIVE_PARENT_ID;
  if (!parentId) throw new Error("Missing GOOGLE_DRIVE_PARENT_ID env var");

  const oauthDrive = getOAuthDrive();

  const search = await oauthDrive.files.list({
    q: `name='${clientName.replace(/'/g, "\\'")}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id, name)",
    spaces: "drive",
  });

  if (search.data.files && search.data.files.length > 0) {
    return search.data.files[0].id!;
  }

  const folder = await oauthDrive.files.create({
    requestBody: {
      name: clientName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id",
  });

  if (!folder.data.id) throw new Error("Failed to create review folder");
  return folder.data.id;
}

// ✅ Upload buffer to Drive using OAuth (personal quota)
export async function uploadBufferToDrive({
  buffer,
  folderId,
  filename,
  mimeType,
}: {
  buffer: Buffer;
  folderId: string;
  filename: string;
  mimeType: string;
}) {
  const oauthDrive = getOAuthDrive();

  const res = await oauthDrive.files.create({
    requestBody: {
      name: filename,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: bufferToStream(buffer),
    },
    fields: "id, webViewLink",
  });

  if (res.data.id) {
    await oauthDrive.permissions.create({
      fileId: res.data.id,
      requestBody: { role: "reader", type: "anyone" },
    });
  }

  return res.data;
}

// ✅ Upload from file path
export async function uploadFileToDrive(
  filePath: string,
  folderId: string,
  fileName: string,
  mimeType: string
) {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error("File does not exist at path: " + filePath);
    }

    const oauthDrive = getOAuthDrive();

    const res = await oauthDrive.files.create({
      requestBody: {
        name: fileName || path.basename(filePath),
        parents: [folderId],
      },
      media: {
        mimeType: mimeType || "application/octet-stream",
        body: fs.createReadStream(filePath),
      },
      fields: "id, name, webViewLink, webContentLink",
    });

    if (res.data.id) {
      await oauthDrive.permissions.create({
        fileId: res.data.id,
        requestBody: { role: "reader", type: "anyone" },
      });
    }

    return res.data;
  } catch (err: any) {
    console.error("❌ Google Drive Upload Error:", err.message || err);
    throw new Error("Failed to upload file to Google Drive");
  } finally {
    if (fs.existsSync(filePath)) {
      fs.unlink(filePath, () => {});
    }
  }
}

// ✅ Create client folder and subfolders
export async function createClientFolders2(clientName: string) {
  try {
    const parentId = process.env.GOOGLE_DRIVE_PARENT_ID;
    if (!parentId) throw new Error("Missing GOOGLE_DRIVE_PARENT_ID env var");

    const oauthDrive = getOAuthDrive();

    const mainFolder = await oauthDrive.files.create({
      requestBody: {
        name: clientName,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentId],
      },
      fields: "id",
    });

    const mainFolderId = mainFolder.data.id;
    if (!mainFolderId) throw new Error("Failed to create main folder");

    const [rawFolder, essentialsFolder] = await Promise.all([
      oauthDrive.files.create({
        requestBody: {
          name: "Raw Footage",
          mimeType: "application/vnd.google-apps.folder",
          parents: [mainFolderId],
        },
        fields: "id",
      }),
      oauthDrive.files.create({
        requestBody: {
          name: "Elements",
          mimeType: "application/vnd.google-apps.folder",
          parents: [mainFolderId],
        },
        fields: "id",
      }),
    ]);

    return {
      mainFolderId,
      rawFolderId: rawFolder.data.id,
      essentialsFolderId: essentialsFolder.data.id,
    };
  } catch (error: any) {
    console.error("❌ Google Drive folder creation failed:", error.message || error);
    throw new Error("Failed to create Google Drive folders");
  }
}

function bufferToStream(buffer: Buffer) {
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
}