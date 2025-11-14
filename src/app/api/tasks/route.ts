export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import fs from "fs";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";
import { uploadFileToDrive } from "../../../lib/googleDrive";
import { uploadBufferToDrive } from "../../../lib/googleDrive";

export const config = {
  api: { bodyParser: false },
};

function getTokenFromCookies(req: Request) {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/authToken=([^;]+)/);
  return match ? match[1] : null;
}

export async function GET(req: Request) {
  try {
    const token = getTokenFromCookies(req);
    if (!token) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    const { role, userId } = decoded;

    // Admin / manager → get all tasks
    // Editor / QC / Scheduler → get only assigned tasks
    const where =
      ["admin", "manager"].includes(role)
        ? {}
        : { assignedTo: Number(userId) };

    const tasks = await prisma.task.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        description: true,
        taskType: true,
        status: true,
        dueDate: true,
        assignedTo: true,
        createdBy: true,
        clientId: true,
        driveLinks: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ tasks }, { status: 200 });
  } catch (err: any) {
    console.error("❌ GET /api/tasks error:", err);
    return NextResponse.json(
      { message: "Server error", error: err.message },
      { status: 500 }
    );
  }
}



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
