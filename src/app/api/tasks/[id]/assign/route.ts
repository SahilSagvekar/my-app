export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { getDbHttp } from "@/lib/db";
import { task, user, client as clientTable } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notifyEditorTaskAssignment } from "../../../../../lib/notify";
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
  const db = getDbHttp();
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
      const [assignee] = await db.select().from(user).where(eq(user.id, assignedTo)).limit(1);
      if (!assignee)
        return NextResponse.json(
          { message: `Assigned user not found (id: ${assignedTo})` },
          { status: 404 }
        );
    }

    if (clientId) {
      const [clientUser] = await db.select().from(user).where(eq(user.id, clientId)).limit(1);
      if (!clientUser)
        return NextResponse.json(
          { message: `Client not found (id: ${clientId})` },
          { status: 404 }
        );
    }

    // Look up current assignee so we only notify on a real reassignment
    const existingTask = assignedTo
      ? (await db.select({ assignedTo: task.assignedTo }).from(task).where(eq(task.id, id)).limit(1))[0]
      : null;

    // Update task
    const [updatedTaskRow] = await db.update(task).set({
      ...(assignedTo && { assignedTo }),
      ...(clientId && { clientId }),
      updatedAt: new Date().toISOString(),
    }).where(eq(task.id, id)).returning();

    const [taskClient] = updatedTaskRow.clientId
      ? await db.select().from(clientTable).where(eq(clientTable.id, updatedTaskRow.clientId)).limit(1)
      : [null];
    const updatedTask = { ...updatedTaskRow, client: taskClient };

    // 🔔 Notify the editor only if they were actually newly assigned
    if (assignedTo && existingTask?.assignedTo !== assignedTo) {
      try {
        await notifyEditorTaskAssignment(assignedTo, [id]);
      } catch (err) {
        console.error("Failed to send assignment notification:", err);
      }
    }

    return NextResponse.json(updatedTask, { status: 200 });
  } catch (err: any) {
    console.error("❌ Task assignment error:", err.message);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}