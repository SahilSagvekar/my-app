import { google } from "googleapis";

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
export async function createClientFolders(clientName: string) {
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
          name: "Essentials",
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
