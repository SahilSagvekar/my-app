// import { NextResponse } from "next/server";
// import { google } from "googleapis";
// import formidable from "formidable";
// import fs from "fs";
// import jwt from "jsonwebtoken";
// import { prisma } from "@/lib/prisma";
// import { uploadFileToDrive } from "../../../lib/googleDrive";

export const runtime = "nodejs"; // ⛔ force real Node runtime (NO edge)
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { IncomingForm } from "formidable";
import fs from "fs";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";
import { uploadFileToDrive } from "../../../lib/googleDrive";
import { uploadBufferToDrive } from "../../../lib/googleDrive";
// import { getTokenFromCookies } from "@/lib/authUtils";

// 🚀 Modern Formidable import for App Router
import formidable from "formidable";

export const config = {
  api: { bodyParser: false },
};

function getTokenFromCookies(req: Request) {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/authToken=([^;]+)/);
  return match ? match[1] : null;
}

// export async function POST(req: Request) {
//   try {
//     const token = getTokenFromCookies(req);
//     if (!token)
//       return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

//     const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
//     if (!["admin", "manager"].includes(decoded.role))
//       return NextResponse.json({ message: "Forbidden" }, { status: 403 });

//     const body = await req.json();
//     const { title, description, taskType, dueDate, assignedTo, clientId } = body;

//     if (!title || !description || !taskType || !dueDate || !assignedTo) {
//       return NextResponse.json(
//         { message: "Missing required fields" },
//         { status: 400 }
//       );
//     }

//     // ✅ Validate clientId (optional)
//     let validClientId = null;
//     if (clientId) {
//       const clientExists = await prisma.client.findUnique({
//         where: { id: clientId },
//       });
//       if (clientExists) validClientId = clientId;
//       else
//         console.warn(`⚠️ Client ID ${clientId} not found, skipping relation.`);
//     }

//     // ✅ Create task safely
//     const task = await prisma.task.create({
//       data: {
//         title,
//         description,
//         taskType,
//         dueDate: new Date(dueDate),
//         assignedTo,
//         createdBy: decoded.userId,
//         clientId: validClientId, // 👈 only includes if valid
//       },
//     });

//     return NextResponse.json(task, { status: 201 });
//   } catch (err: any) {
//     console.error("❌ Create task error:", err.message, err.code || "");
//     return NextResponse.json({ message: "Server error" }, { status: 500 });
//   }
// }

// export async function POST(req: Request) {
//   try {
//     // Parse body/form data (see note below about file upload setup)
//     // Example: const { clientId, folderType } = req.body; const file = req.file;

//     // Fetch client’s folder IDs
//     const body = await req.json();
//     const { clientId, folderType, file } = body; // extract clientId here

//     if (!clientId) return NextResponse.json({ message: "Missing clientId" }, { status: 400 });

//     const client = await prisma.client.findUnique({
//       where: { id: clientId },
//       select: { rawFootageFolderId: true, essentialsFolderId: true },
//     });
//     if (!client) return NextResponse.json({ message: "Client not found" }, { status: 404 });

//     // Choose correct subfolder
//     const folderId =
//       folderType === "raw footage"
//         ? client.rawFootageFolderId
//         : client.essentialsFolderId;

//     if (!folderId) {
//       return NextResponse.json(
//         { message: `Folder ID not found for ${folderType}` },
//         { status: 400 }
//       );
//     }

//     // Initialize Drive service
//     const drive = getDriveService();

//     // Upload file
//     const fileData = await uploadToDrive({ drive, file, folderId });

//     // Save task (and file reference) to DB as needed

//     return NextResponse.json({ success: true, file: fileData }, { status: 201 });
//   } catch (err: any) {
//     console.error("❌ Drive upload error:", err.message, err.code || "");
//     return NextResponse.json({ message: "Server error" }, { status: 500 });
//   }
// }

export async function POST(req: Request) {
  try {
    // ------------- AUTH --------------
    const token = getTokenFromCookies(req);
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    if (!["admin", "manager"].includes(decoded.role)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    // ------------- PARSE FORM DATA --------------
    const form = await req.formData();

    const title = form.get("title") as string;
    const description = form.get("description") as string;
    const taskType = form.get("taskType") as string;
    const dueDate = form.get("dueDate") as string;
    const assignedTo = form.get("assignedTo") as string;
    const clientId = form.get("clientId") as string;
    const folderType = form.get("folderType") as string;

    if (!title || !taskType || !dueDate || !assignedTo || !folderType) {
      return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
    }

    // ------------- FETCH CLIENT FOLDER --------------
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { rawFootageFolderId: true, essentialsFolderId: true },
    });

    if (!client) {
      return NextResponse.json({ message: "Client not found" }, { status: 404 });
    }

    const targetFolder =
      folderType === "rawFootage"
        ? client.rawFootageFolderId
        : client.essentialsFolderId;

    if (!targetFolder) {
      return NextResponse.json(
        { message: `Folder ID not found for ${folderType}` },
        { status: 400 }
      );
    }

    // ------------- FILE UPLOAD --------------
    const uploadedLinks = [];

    const files = form.getAll("files") as File[];

    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const uploaded = await uploadBufferToDrive({
        buffer,
        folderId: targetFolder,
        filename: file.name,
        mimeType: file.type,
      });

      uploadedLinks.push(uploaded.webViewLink);
    }

    // ------------- CREATE TASK --------------
    const task = await prisma.task.create({
      data: {
        title,
        description,
        taskType,
        dueDate: new Date(dueDate),
        assignedTo: Number(assignedTo),
        createdBy: decoded.userId,
        clientId: clientId || null,
        driveLinks: uploadedLinks,
      },
    });

    return NextResponse.json(task, { status: 201 });
  } catch (err: any) {
    console.error("❌ Create task error:", err);
    return NextResponse.json(
      { message: "Server error", error: err.message },
      { status: 500 }
    );
  }
}
