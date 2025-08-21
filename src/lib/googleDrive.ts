import { google } from "googleapis";

if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
  throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY is not set in .env");
}

// ✅ Do NOT parse and replace manually, let GoogleAuth handle it
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
  scopes: ["https://www.googleapis.com/auth/drive"],
});

export const drive = google.drive({ version: "v3", auth });



// export async function createClientFolders(clientName: string) {
//   const auth = await getOAuthClient();
//   const drive = google.drive({ version: "v3", auth });

//   // Step 1: Create parent folder
//   const parentRes = await drive.files.create({
//     requestBody: {
//       name: clientName,
//       mimeType: "application/vnd.google-apps.folder",
//     },
//     fields: "id",
//   });

//   const parentId = parentRes.data.id;

//   // Step 2: Create "Raw Footage" subfolder
//   const rawRes = await drive.files.create({
//     requestBody: {
//       name: "Raw Footage",
//       mimeType: "application/vnd.google-apps.folder",
//       parents: [parentId!],
//     },
//     fields: "id",
//   });

//   const essentialsRes = await drive.files.create({
//     requestBody: {
//       name: "Essentials",
//       mimeType: "application/vnd.google-apps.folder",
//       parents: [parentId!],
//     },
//     fields: "id",
//   });

//   return {
//     parentId,
//     rawId: rawRes.data.id,
//     essentialsId: essentialsRes.data.id,
//   };
// }


// // lib/googleDrive.ts
// import { google } from "googleapis";

// export function getOAuthClient() {
//   const client = new google.auth.OAuth2(
//     process.env.GOOGLE_CLIENT_ID,
//     process.env.GOOGLE_CLIENT_SECRET,
//     process.env.GOOGLE_REDIRECT_URI
//   );

//   client.setCredentials({
//     refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
//   });

//   return client;
// }

// export function getDrive() {
//   const auth = getOAuthClient();
//   return google.drive({ version: "v3", auth });
// }
