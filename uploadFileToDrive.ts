import { google } from "googleapis";
import fs from "fs";

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_OAUTH_CLIENT_ID,
  process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

const drive = google.drive({ version: "v3", auth: oauth2Client });

export async function uploadFileToDrive(
  filePath: string,
  folderId: string,
  fileName: string,
  mimeType: string
) {
  try {
    const res = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId],
      },
      media: {
        mimeType,
        body: fs.createReadStream(filePath),
      },
      fields: "id, name, webViewLink, webContentLink",
    });

    console.log("✅ Uploaded file:", res.data.name);
    return res.data;
  } catch (err: any) {
    console.error("❌ Drive upload error:", err.response?.data || err.message);
    throw err;
  }
}
