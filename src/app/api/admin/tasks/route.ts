import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { google } from "googleapis";
import { requireAdmin } from "@/lib/auth";
import { drive } from "@/lib/googleAuth"; // ✅ import your pre-configured drive instance
import { Readable } from "stream";
import { getOAuthClient } from "@/lib/googleAuth";

export const config = {
  api: {
    bodyParser: false, // important for file uploads
  },
};

export async function POST(req: NextRequest) {
  try {
    const user = await requireAdmin(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await req.formData();
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const taskType = formData.get("taskType") as string;
    const dueDate = formData.get("dueDate") as string;
    const assignedTo = formData.get("assignedTo") as string;
    const clientId = formData.get("clientId") as string;
    const folderType = formData.get("folderType") as string;
    const file = formData.get("file") as File | null;

    if (!title || !taskType || !assignedTo || !dueDate || !clientId || !folderType) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    const assignedToId = parseInt(assignedTo, 10);
    if (isNaN(assignedToId)) return NextResponse.json({ error: "Invalid assignedTo ID" }, { status: 400 });

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, rawFolderId: true, essentialsFolderId: true },
    });

    if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

    let driveFolderId = "";
    if (folderType === "raw") driveFolderId = client.rawFolderId;
    else if (folderType === "essentials") driveFolderId = client.essentialsFolderId;
    else return NextResponse.json({ error: "Invalid folder type" }, { status: 400 });

    const auth = getOAuthClient();
    auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    const drive = google.drive({ version: "v3", auth });


    let fileId: string | null = null;
    if (file) {
      // Convert Web File to Node stream
      const buffer = Buffer.from(await file.arrayBuffer());
      const nodeStream = Readable.from(buffer);
    
      const driveResponse = await drive.files.create({
        requestBody: {
          name: file.name,
          parents: [driveFolderId],
        },
        media: {
          mimeType: file.type || "application/octet-stream",
          body: nodeStream,
        },
        fields: "id",
      });

      fileId = driveResponse.data.id || null;
    }

    const newTask = await prisma.task.create({
      data: {
        title,
        description,
        taskType,
        dueDate: new Date(dueDate),
        assignedTo: assignedToId,
        clientId,
        createdBy: user.id,
        driveFolderId,
        // fileId, // optional: save the uploaded file ID if needed
      },
    });

    return NextResponse.json({ message: "Task created successfully", task: newTask }, { status: 201 });
  } catch (err) {
    console.error("Error creating task:", err);
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}
