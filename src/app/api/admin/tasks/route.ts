// app/api/admin/tasks/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { requireAdmin } from "../../../../lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, description, taskType, dueDate, assignedTo } = body;

    // Validation
    if (!title || !description || !taskType || !dueDate || !assignedTo) {
      return NextResponse.json(
        { message: "All fields are required" },
        { status: 400 }
      );
    }

    // Authenticate admin
    const user = await requireAdmin(req);
    if (!user) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    // Create task in DB
    const task = await prisma.task.create({
      data: {
        title,
        description,
        taskType,
        dueDate: new Date(dueDate),
        assignedTo: parseInt(assignedTo, 10),
        createdBy: user.id,
      },
    });

    return NextResponse.json(task, { status: 201 });
  } catch (err) {
    console.error("Task creation error:", err);
    return NextResponse.json(
      { message: "Failed to create task" },
      { status: 500 }
    );
  }
}
