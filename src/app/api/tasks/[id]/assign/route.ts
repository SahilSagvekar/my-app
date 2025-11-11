import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import jwt from "jsonwebtoken";

function getTokenFromCookies(req: Request) {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/authToken=([^;]+)/);
  return match ? match[1] : null;
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const token = getTokenFromCookies(req);
    if (!token)
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    const { role, userId } = decoded;

    // Only admins and managers can assign tasks
    if (!["admin", "manager"].includes(role.toLowerCase())) {
      return NextResponse.json(
        { message: "Forbidden — insufficient permissions" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { assignedTo, clientId } = body;

    if (!assignedTo && !clientId) {
      return NextResponse.json(
        { message: "At least one field (assignedTo or clientId) is required" },
        { status: 400 }
      );
    }

    // Validate users exist
    if (assignedTo) {
      const assignee = await prisma.user.findUnique({ where: { id: assignedTo } });
      if (!assignee)
        return NextResponse.json(
          { message: `Assigned user not found (id: ${assignedTo})` },
          { status: 404 }
        );
    }

    if (clientId) {
      const client = await prisma.user.findUnique({ where: { id: clientId } });
      if (!client)
        return NextResponse.json(
          { message: `Client not found (id: ${clientId})` },
          { status: 404 }
        );
    }

    // Update task
    const updatedTask = await prisma.task.update({
      where: { id },
      data: {
        ...(assignedTo && { assignedTo }),
        ...(clientId && { clientId }),
        updatedAt: new Date(),
      },
      include: {
        // assignedUser: true,
        client: true,
      },
    });

    return NextResponse.json(updatedTask, { status: 200 });
  } catch (err: any) {
    console.error("❌ Task assignment error:", err.message);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
