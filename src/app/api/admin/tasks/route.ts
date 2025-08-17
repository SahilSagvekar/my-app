import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { requireAdmin } from '../../../../lib/auth';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { title, description, taskType, dueDate, assignedTo } = body;

  if (!title || !description || !taskType || !dueDate || !assignedTo) {
    return NextResponse.json({ message: 'All fields are required' }, { status: 400 });
  }

  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ message: 'Oops' }, { status: 401 });
  try {
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

    return NextResponse.json(task, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: 'Failed to create task' }, { status: 500 });
  }
}
