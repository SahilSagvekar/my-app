import { google } from "googleapis";
// import * as fs from "fs";
import fs from "fs";
import path from "path";
// import { getOAuthClient } from "../lib/googleAuth";
import { getDriveClient } from "./googleAuth";
// import { drive } from "./googleClient"; // your initialized Drive client
import { Readable } from "stream";


console.log("🔍 Checking env key format...");
const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
if (!key) {
  console.error("❌ Missing GOOGLE_SERVICE_ACCOUNT_KEY");
} else {
  console.log("Raw key starts with:", JSON.stringify(key.slice(0, 50)));
  console.log("Raw key ends with:", JSON.stringify(key.slice(-50)));
  console.log("Contains \\n sequences?", key.includes("\\n"));
}


// ✅ Create the Google Auth client using env variables
const auth = new google.auth.JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  // Important: must use single quotes for actual newline replacement
  key: process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.replace(/\\n/g, '\n'),
  scopes: ["https://www.googleapis.com/auth/drive"],
});

// ✅ Initialize Drive API
const drive = google.drive({ version: "v3", auth });

// ✅ Function to create client folder and subfolders
export async function createClientFolders2(clientName: string) {
  try {
    const parentId = process.env.GOOGLE_DRIVE_PARENT_ID;
    if (!parentId) throw new Error("Missing GOOGLE_DRIVE_PARENT_ID env var");

    // --- Create main client folder
    const mainFolder = await drive.files.create({
      requestBody: {
        name: clientName,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentId],
      },
      fields: "id",
    });

    const mainFolderId = mainFolder.data.id;
    if (!mainFolderId) throw new Error("Failed to create main folder");

    // --- Create subfolders
    const [rawFolder, essentialsFolder] = await Promise.all([
      drive.files.create({
        requestBody: {
          name: "Raw Footage",
          mimeType: "application/vnd.google-apps.folder",
          parents: [mainFolderId],
        },
        fields: "id",
      }),
      drive.files.create({
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

// const auth = new google.auth.GoogleAuth({
//   credentials: {
//     client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
//     private_key: process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.replace(/\\n/g, "\n"),
//   },
//   scopes: ["https://www.googleapis.com/auth/drive.file"],
// });

// const drive = google.drive({ version: "v3", auth });

export async function uploadFileToDrive(
  filePath: string,
  folderId: string,
  fileName: string,
  mimeType: string
) {
  try {
    // Safety: ensure file exists
    if (!fs.existsSync(filePath)) {
      throw new Error("File does not exist at path: " + filePath);
    }

    const realMime = mimeType || "application/octet-stream";

    const res = await drive.files.create({
      requestBody: {
        name: fileName || path.basename(filePath),
        parents: [folderId],
      },
      media: {
        mimeType: realMime,
        body: fs.createReadStream(filePath),
      },
      fields: "id, name, webViewLink, webContentLink",
    });

    // Always make file readable
    await drive.permissions.create({
      fileId: res.data.id!,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
    });

    return res.data;
  } catch (err: any) {
    console.error("❌ Google Drive Upload Error:", err.message || err);
    throw new Error("Failed to upload file to Google Drive");
  } finally {
    // Cleanup: remove temp file
    if (fs.existsSync(filePath)) {
      fs.unlink(filePath, () => {});
    }
  }
}

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
  // const drive = google.drive({ version: "v3", auth });
  const drive = getDriveClient();

  const res = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: BufferToStream(buffer),
    },
    fields: "id, webViewLink",
  });

  return res.data;
}

// export async function uploadBufferToDrive({
//   buffer,
//   folderId,
//   filename,
//   mimeType,
// }: {
//   buffer: Buffer;
//   folderId: string;
//   filename: string;
//   mimeType: string;
// }) {
//   const res = await drive.files.create({
//     requestBody: {
//       name: filename,
//       parents: [folderId],
//     },
//     media: {
//       mimeType,
//       body: BufferToStream(buffer),
//     },
//     fields: "id, webViewLink",
//   });

//   return res.data;
// }


function BufferToStream(buffer: Buffer) {
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
}

