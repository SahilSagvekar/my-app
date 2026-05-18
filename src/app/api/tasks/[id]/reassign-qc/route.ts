export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { getCurrentUser2 } from '@/lib/auth';

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const user = await getCurrentUser2(req as any);
    if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const role = user.role?.toLowerCase();
    if (!['qc', 'admin', 'manager'].includes(role || '')) {
      return NextResponse.json({ message: 'Forbidden — QC, Admin, or Manager only' }, { status: 403 });
    }

    const body = await req.json();
    const { newQcSpecialistId } = body;

    if (!newQcSpecialistId) {
      return NextResponse.json({ message: 'newQcSpecialistId is required' }, { status: 400 });
    }

    // Verify the target user exists and is a QC specialist
    const targetUser = await prisma.user.findUnique({
      where: { id: Number(newQcSpecialistId) },
      select: { id: true, name: true, role: true, employeeStatus: true },
    });

    if (!targetUser) {
      return NextResponse.json({ message: 'Target user not found' }, { status: 404 });
    }

    if (targetUser.role?.toLowerCase() !== 'qc') {
      return NextResponse.json({ message: 'Target user is not a QC specialist' }, { status: 400 });
    }

    if (targetUser.employeeStatus !== 'ACTIVE') {
      return NextResponse.json({ message: 'Target QC specialist is not active' }, { status: 400 });
    }

    // Verify the task exists and is in a QC-relevant status
    const task = await prisma.task.findUnique({
      where: { id },
      select: { id: true, title: true, status: true, qc_specialist: true },
    });

    if (!task) {
      return NextResponse.json({ message: 'Task not found' }, { status: 404 });
    }

    // If QC role (not admin/manager), ensure they are the current qc_specialist
    if (role === 'qc' && task.qc_specialist !== user.id) {
      return NextResponse.json(
        { message: 'You can only reassign tasks assigned to you' },
        { status: 403 }
      );
    }

    const updated = await prisma.task.update({
      where: { id },
      data: {
        qc_specialist: Number(newQcSpecialistId),
        updatedAt: new Date(),
      },
      select: {
        id: true,
        title: true,
        status: true,
        qc_specialist: true,
      },
    });

    return NextResponse.json({
      message: `Task reassigned to ${targetUser.name}`,
      task: updated,
    });
  } catch (err: any) {
    console.error('❌ QC reassign error:', err.message);
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}