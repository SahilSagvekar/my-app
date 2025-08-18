import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from '@prisma/client'; // make sure prisma client is exported from lib/prisma.ts
import { getCurrentUser } from "@/lib/auth"; // a function to decode JWT and get user

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req); // your auth function
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { title, description, taskType, dueDate, assignedTo } = body;

    if (!title || !description || !taskType || !dueDate || !assignedTo) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

     // 1. Create the task
    const task = await prisma.task.create({
      data: {
        title,
        description,
        taskType,
        dueDate: new Date(dueDate),
        assignedTo,
        createdBy: user.id,
      },
    });

    // 2. Create a notification for the assigned user
    const notification = await prisma.notification.create({
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

