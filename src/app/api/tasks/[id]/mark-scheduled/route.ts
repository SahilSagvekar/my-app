import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notify";

function getTokenFromCookies(req: Request) {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;
  const m = cookieHeader.match(/authToken=([^;]+)/);
  return m ? m[1] : null;
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const token = getTokenFromCookies(req);
    if (!token)
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    const { role } = decoded;
    if (
      !["scheduler", "manager", "admin"].includes((role || "").toLowerCase())
    ) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const { postedAt, notes } = await req.json().catch(() => ({}));

    const { id } = await context.params;

    const updated = await prisma.task.update({
      where: { id },
      data: {
        status: "SCHEDULED",
        // scheduledAt: postedAt ? new Date(postedAt) : new Date(),
        // scheduledNotes: notes || null,
        updatedAt: new Date(),
      },
    });

    // 🔔 Notify editor and client
    try {
      // Notify Editor
      await notifyUser({
        userId: updated.assignedTo,
        type: "task_scheduled",
        title: "Content Scheduled/Posted",
        body: `Your task "${updated.title}" has been marked as scheduled.`,
        payload: { taskId: updated.id }
      });

      // Notify Client User
      if (updated.clientUserId) {
        await notifyUser({
          userId: updated.clientUserId,
          type: "task_scheduled",
          title: "Content Live",
          body: `Content "${updated.title}" is now live/scheduled.`,
          payload: { taskId: updated.id }
        });
      }
    } catch (notifErr) {
      console.error("Failed to send scheduled notification:", notifErr);
    }

    return NextResponse.json({ task: updated }, { status: 200 });
  } catch (err: any) {
    console.error("PATCH /api/tasks/:id/mark-scheduled error:", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
