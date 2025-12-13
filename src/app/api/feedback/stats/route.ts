// app/api/feedback/stats/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken } from '@/lib/auth-helpers';

export async function GET(req: NextRequest) {
  try {
    const currentUser = getUserFromToken(req);
    
    if (!currentUser) {
      return NextResponse.json(
        { ok: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Build where clause based on role
    let where: any = {};
    if (!['admin', 'manager'].includes(currentUser.role)) {
      where.senderId = currentUser.userId;
    }

    const [total, pending, acknowledged, inProgress, resolved] = await Promise.all([
      prisma.feedback.count({ where }),
      prisma.feedback.count({ where: { ...where, status: 'PENDING' } }),
      prisma.feedback.count({ where: { ...where, status: 'ACKNOWLEDGED' } }),
      prisma.feedback.count({ where: { ...where, status: 'IN_PROGRESS' } }),
      prisma.feedback.count({ where: { ...where, status: 'RESOLVED' } })
    ]);

    return NextResponse.json({
      ok: true,
      stats: {
        total,
        pending,
        acknowledged,
        inProgress,
        resolved
      }
    });

  } catch (error) {
    console.error('Error fetching feedback stats:', error);
    return NextResponse.json(
      { ok: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}