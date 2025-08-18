import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user || (user.role !== "admin" && user.role !== "manager")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { title, description, taskType, dueDate, assignedTo } = body;

    if (!title || !description || !taskType || !dueDate || !assignedTo) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    const task = await prisma.task.create({
      data: {
        title,
        description,
        taskType: taskType,
        dueDate: new Date(dueDate),
        createdBy: user.id,
        assignedTo: assignedTo,
      },
    });

    await prisma.notification.create({
      data: {
        userId: assignedTo,
        message: `You have been assigned a new task: ${title}`,
      },
    });

    return NextResponse.json(task, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const tasks = await prisma.task.findMany({
      include: {
        // assignee: {
        //   select: { id: true, name: true, avatar: true, role: true },
        // },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(tasks);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
  }
}
