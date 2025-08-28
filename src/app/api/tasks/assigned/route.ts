import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser2 } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser2(req as any);
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const tasks = await prisma.task.findMany({
      where: { assignedTo: user.userId },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        assignedTo: true,
        // assignedToName: true,
        // assignedToRole: true,
        createdAt: true,
        dueDate: true,
        // workflowStep: true,
        // projectId: true,
        // parentTaskId: true,
        // files: true,
        // feedback: true,
        // rejectionReason: true,
        // originalTaskId: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ tasks });
  } catch (err) {
    console.error("Error fetching tasks:", err);
    return NextResponse.json(
      { error: "Failed to fetch tasks" },
      { status: 500 }
    );
  }
}
