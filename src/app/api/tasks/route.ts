import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import jwt from "jsonwebtoken";

function getTokenFromCookies(req: Request) {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/authToken=([^;]+)/);
  return match ? match[1] : null;
}

export async function GET(req: Request) {
  try {
    const token = getTokenFromCookies(req);
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    const { role, userId } = decoded;

    let tasks;

    if (role === "admin" || role === "manager") {
      tasks = await prisma.task.findMany({
        include: { client: true, user: true },
        orderBy: { createdAt: "desc" },
      });
    } else {
      tasks = await prisma.task.findMany({
        where: { assignedTo: userId },
        include: { client: true, user: true },
        orderBy: { createdAt: "desc" },
      });
    }

    return NextResponse.json(tasks);
  } catch (err) {
    console.error("Fetch tasks error:", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const token = getTokenFromCookies(req);
    if (!token)
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    if (!["admin", "manager"].includes(decoded.role))
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const { title, description, taskType, dueDate, assignedTo, clientId } = body;

    if (!title || !description || !taskType || !dueDate || !assignedTo) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 }
      );
    }

    // ✅ Validate clientId (optional)
    let validClientId = null;
    if (clientId) {
      const clientExists = await prisma.client.findUnique({
        where: { id: clientId },
      });
      if (clientExists) validClientId = clientId;
      else
        console.warn(`⚠️ Client ID ${clientId} not found, skipping relation.`);
    }

    // ✅ Create task safely
    const task = await prisma.task.create({
      data: {
        title,
        description,
        taskType,
        dueDate: new Date(dueDate),
        assignedTo,
        createdBy: decoded.userId,
        clientId: validClientId, // 👈 only includes if valid
      },
    });

    return NextResponse.json(task, { status: 201 });
  } catch (err: any) {
    console.error("❌ Create task error:", err.message, err.code || "");
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}

