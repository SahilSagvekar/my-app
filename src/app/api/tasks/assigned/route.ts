import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
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
    if (!token)
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    const { userId, role } = decoded;

    let tasks;

    switch (role.toLowerCase()) {
      case "editor":
        tasks = await prisma.task.findMany({
          where: { assignedTo: userId },
          include: { client: true },
          orderBy: { updatedAt: "desc" },
        });
        break;

      case "qc_specialist":
        tasks = await prisma.task.findMany({
          where: { status: "READY_FOR_QC" },
          include: { client: true, user: true },
          orderBy: { updatedAt: "desc" },
        });
        break;

      case "videographer":
        tasks = await prisma.task.findMany({
          where: { taskType: "INGEST", assignedTo: userId },
          include: { client: true },
          orderBy: { updatedAt: "desc" },
        });
        break;

      case "scheduler":
        tasks = await prisma.task.findMany({
          where: { status: "COMPLETED" },
          include: { client: true },
          orderBy: { updatedAt: "desc" },
        });
        break;

      case "client":
        tasks = await prisma.task.findMany({
          where: { 
            status: 'CLIENT_REVIEW',
            // clientId: userId 
          },
          include: { user: true },
          orderBy: { updatedAt: "desc" },
        });
        break;

      case "manager":
      case "admin":
        tasks = await prisma.task.findMany({
          include: { client: true, user: true },
          orderBy: { createdAt: "desc" },
        });
        break;

      default:
        return NextResponse.json(
          { message: "Role not recognized" },
          { status: 400 }
        );
    }

    return NextResponse.json(tasks, { status: 200 });
  } catch (err: any) {
    console.error("❌ Fetch assigned tasks error:", err.message);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
