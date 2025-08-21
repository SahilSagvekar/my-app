import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getOAuthClient } from "@/lib/googleAuth"; // <-- Your OAuth helper
import { prisma } from "@/lib/prisma";
import { drive } from "@/lib/googleDrive";

export async function POST(req: Request) {
  try {
    const { name, email, company, phone, longFormVideos, shortFormClips, socialPosts, customDeliverables } = await req.json();

    if (!name?.trim() || !email?.trim()) {
      return NextResponse.json({ error: "Client name and email are required." }, { status: 400 });
    }

    // ✅ Get authenticated OAuth2 client
    const auth = getOAuthClient();
    auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    const drive = google.drive({ version: "v3", auth });

    const ROOT_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!ROOT_FOLDER_ID) return NextResponse.json({ error: "Root folder ID is missing" }, { status: 500 });

    // ✅ Create parent folder
    const parentRes = await drive.files.create({
      requestBody: {
        name,
        mimeType: "application/vnd.google-apps.folder",
        parents: [ROOT_FOLDER_ID],
      },
      fields: "id, name",
    });

    const parentFolderId = parentRes.data.id!;
    if (!parentFolderId) return NextResponse.json({ error: "Failed to create parent folder" }, { status: 500 });

    // ✅ Create subfolders
    const rawRes = await drive.files.create({
      requestBody: {
        name: "Raw Footage",
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentFolderId],
      },
      fields: "id",
    });

    const essentialsRes = await drive.files.create({
      requestBody: {
        name: "Essentials",
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentFolderId],
      },
      fields: "id",
    });

    // ✅ Store client in DB
    const client = await prisma.client.create({
      data: {
        name,
        email,
        company,
        phone,
        longFormVideos,
        shortFormClips,
        socialPosts,
        customDeliverables,
        driveFolderId: parentFolderId,
        rawFolderId: rawRes.data.id!,
        essentialsFolderId: essentialsRes.data.id!,
      },
    });

    return NextResponse.json({ client });
  } catch (err: any) {
    console.error("Error creating client:", err);
    return NextResponse.json({ error: err.message || "Failed to create client" }, { status: 500 });
  }
}

// export async function POST(req: NextRequest) {
//   try {
//     const { name } = await req.json();

//     if (!name) {
//       return NextResponse.json({ error: "Client name is required" }, { status: 400 });
//     }

//     // ✅ Get OAuth2 client
//     const auth = await getOAuthClient();
//     const drive = google.drive({ version: "v3", auth });

//     // ✅ Root folder ID (replace this with your Google Drive folder ID)
//     const ROOT_FOLDER_ID = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
//     if (!ROOT_FOLDER_ID) {
//       return NextResponse.json({ error: "Missing root folder ID" }, { status: 500 });
//     }

//     // ✅ Create parent folder for the client
//     const parentRes = await drive.files.create({
//       requestBody: {
//         name,
//         mimeType: "application/vnd.google-apps.folder",
//         parents: [ROOT_FOLDER_ID],
//       },
//       fields: "id, name", // ✅ Only fetch necessary fields
//     });

//     const parentFolderId = parentRes.data.id;
//     if (!parentFolderId) {
//       return NextResponse.json({ error: "Failed to create parent folder" }, { status: 500 });
//     }

//     // ✅ Create subfolders inside the client folder
//     const subFolders = ["Raw Footage", "Essentials"];
//     const createdFolders: { name: string; id: string }[] = [];

//     for (const folderName of subFolders) {
//       const folderRes = await drive.files.create({
//         requestBody: {
//           name: folderName,
//           mimeType: "application/vnd.google-apps.folder",
//           parents: [parentFolderId],
//         },
//         fields: "id, name",
//       });

//       if (folderRes.data.id) {
//         createdFolders.push({ name: folderName, id: folderRes.data.id });
//       }
//     }

//     // 3️⃣ Save client in DB
//     const client = await prisma.client.create({
//       data: {
//         name,
//         email,
//         company,
//         phone,
//         driveFolderId: parentRes.data.id!,
//         rawFolderId: rawRes.data.id!,
//         essentialsFolderId: essentialsRes.data.id!,
//       },
//     });

//     return NextResponse.json({
//       message: "Client folders created successfully",
//       clientFolderId: parentFolderId,
//       subFolders: createdFolders,
//     });
//   } catch (error: any) {
//     console.error("Error creating client:", error);
//     return NextResponse.json({ error: error.message }, { status: 500 });
//   }
// }
