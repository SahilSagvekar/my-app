export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { user, task } from '@/lib/db/schema';
import { and, eq, ne, inArray, asc, count } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth';

export async function GET(req: Request, { params }: { params: { employeeId: string } }) {
  const db = getDbHttp();
  try {
    await requireAdmin(req as any);
    const resolvedParams = await Promise.resolve(params);
    const id = Number(resolvedParams.employeeId);

    // Get the user's role
    const [foundUser] = await db.select({ id: user.id, name: user.name, role: user.role, employeeStatus: user.employeeStatus })
      .from(user).where(eq(user.id, id)).limit(1);

    if (!foundUser) {
      return NextResponse.json({ ok: false, message: 'User not found' }, { status: 404 });
    }

    // Active statuses — tasks that need reassignment
    const activeStatuses = ['PENDING', 'IN_PROGRESS', 'REJECTED_BY_QC', 'REJECTED_BY_CLIENT', 'READY_FOR_QC'];

    // Fetch all active tasks assigned to this user
    const rawTasks = await db.query.task.findMany({
      where: and(eq(task.assignedTo, id), inArray(task.status, activeStatuses as any)),
      columns: {
        id: true,
        title: true,
        status: true,
        dueDate: true,
        deliverableType: true,
        clientId: true,
      },
      with: {
        client: { columns: { id: true, name: true, companyName: true } },
        monthlyDeliverable: { columns: { type: true } },
        oneOffDeliverable: { columns: { type: true } },
      },
      orderBy: (t, { asc }) => [asc(t.status), asc(t.dueDate)],
    });
    const tasks = rawTasks;

    // Fetch eligible reassignment candidates (active users with same role)
    const candidateRows = await db.select({ id: user.id, name: user.name, email: user.email })
      .from(user)
      .where(and(eq(user.role, foundUser.role as any), eq(user.employeeStatus, 'ACTIVE'), ne(user.id, id)))
      .orderBy(asc(user.name));

    // Active-task count per candidate — filtered relation count, done as a
    // grouped query instead of a per-row correlated count.
    const candidateIds = candidateRows.map(c => c.id);
    const activeTaskCounts = candidateIds.length > 0
      ? await db.select({ assignedTo: task.assignedTo, value: count() })
          .from(task)
          .where(and(inArray(task.assignedTo, candidateIds), inArray(task.status, activeStatuses as any)))
          .groupBy(task.assignedTo)
      : [];
    const activeTaskCountMap = new Map(activeTaskCounts.map(c => [c.assignedTo, c.value]));

    const formattedCandidates = candidateRows.map(c => ({
      id: c.id,
      name: c.name,
      email: c.email,
      activeTaskCount: activeTaskCountMap.get(c.id) || 0,
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
      user: { id: foundUser.id, name: foundUser.name, role: foundUser.role },
      tasks: formattedTasks,
      taskCount: formattedTasks.length,
      candidates: formattedCandidates,
    });
  } catch (err: any) {
    console.error('Error fetching active tasks:', err);
    return NextResponse.json({ ok: false, message: err?.message || 'error' }, { status: 400 });
  }
}