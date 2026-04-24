export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

export async function GET(req: Request, { params }: { params: { employeeId: string } }) {
  try {
    await requireAdmin(req as any);
    const resolvedParams = await Promise.resolve(params);
    const id = Number(resolvedParams.employeeId);

    // Get the user's role
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, role: true, employeeStatus: true },
    });

    if (!user) {
      return NextResponse.json({ ok: false, message: 'User not found' }, { status: 404 });
    }

    // Active statuses — tasks that need reassignment
    const activeStatuses = ['PENDING', 'IN_PROGRESS', 'REJECTED', 'READY_FOR_QC'];

    // Fetch all active tasks assigned to this user
    const tasks = await prisma.task.findMany({
      where: {
        assignedTo: id,
        status: { in: activeStatuses },
      },
      select: {
        id: true,
        title: true,
        status: true,
        dueDate: true,
        deliverableType: true,
        clientId: true,
        client: {
          select: { id: true, name: true, companyName: true },
        },
        monthlyDeliverable: {
          select: { type: true },
        },
        oneOffDeliverable: {
          select: { type: true },
        },
      },
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
    });

    // Fetch eligible reassignment candidates (active users with same role)
    const candidates = await prisma.user.findMany({
      where: {
        role: user.role,
        employeeStatus: 'ACTIVE',
        id: { not: id }, // exclude the user being deactivated
      },
      select: {
        id: true,
        name: true,
        email: true,
        _count: {
          select: {
            assignedTasks: {
              where: { status: { in: activeStatuses } },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const formattedCandidates = candidates.map(c => ({
      id: c.id,
      name: c.name,
      email: c.email,
      activeTaskCount: c._count.assignedTasks,
    }));

    const formattedTasks = tasks.map(t => ({
      id: t.id,
      title: t.title,
      status: t.status,
      dueDate: t.dueDate,
      deliverableType: t.monthlyDeliverable?.type || t.oneOffDeliverable?.type || t.deliverableType || 'Unknown',
      clientName: t.client?.companyName || t.client?.name || 'Unknown',
      clientId: t.clientId,
    }));

    return NextResponse.json({
      ok: true,
      user: { id: user.id, name: user.name, role: user.role },
      tasks: formattedTasks,
      taskCount: formattedTasks.length,
      candidates: formattedCandidates,
    });
  } catch (err: any) {
    console.error('Error fetching active tasks:', err);
    return NextResponse.json({ ok: false, message: err?.message || 'error' }, { status: 400 });
  }
}