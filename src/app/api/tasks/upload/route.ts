import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadFileToDrive } from "@/lib/googleDrive";
import { IncomingForm } from "formidable";
import fs from "fs";

export const config = {
  api: { bodyParser: false }, // Important for file uploads
};

export async function POST(req: Request) {
  try {
    const form = new IncomingForm();
    const data: any = await new Promise((resolve, reject) => {
      form.parse(req as any, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    const { folderType, clientId } = data.fields;
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) return NextResponse.json({ message: "Client not found" }, { status: 404 });

    // Determine target folder
    let targetFolderId = "";
    if (folderType === "rawFootage") targetFolderId = client.rawFootageFolderId!;
    else if (folderType === "essentials") targetFolderId = client.essentialsFolderId!;
    else targetFolderId = client.driveFolderId!; // default or custom folder

    const uploadedFiles = [];

    for (const file of Object.values(data.files.files as any[])) {
      const filePath = file.filepath;
      const fileName = file.originalFilename;
      const mimeType = file.mimetype;

      const uploaded = await uploadFileToDrive(filePath, targetFolderId, fileName, mimeType);
      uploadedFiles.push(uploaded);

      fs.unlinkSync(filePath); // cleanup temp file
    }

    return NextResponse.json({ success: true, uploadedFiles });
  } catch (error: any) {
    console.error("❌ Upload failed:", error.message);
    return NextResponse.json({ message: "Upload failed", error: error.message }, { status: 500 });
  }
}
