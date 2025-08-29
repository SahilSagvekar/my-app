import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser2 } from "@/lib/auth";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
 const { id: taskId } = await params; 

  console.log("Patch request for taskId:", taskId);

  if (!taskId) {
    return NextResponse.json({ error: "Missing task ID" }, { status: 400 });
  }

  try {
    const user = await getCurrentUser2(req as any);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { status } = body;
    
    if (!status) return NextResponse.json({ error: "Missing status update" }, { status: 400 });

    const task = await prisma.task.findUnique({ where: { id: taskId } });

    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    // Authorization and update logic here...

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: { status: status.toUpperCase() },
    });

    return NextResponse.json(updatedTask);
  } catch (error) {
    console.error("Failed to update task status:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
