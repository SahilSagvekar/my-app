// app/api/admin/audit-logs/users/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken, requireAdmin } from '@/lib/auth-helpers';

export async function GET(req: NextRequest) {
  try {
    const currentUser = getUserFromToken(req);
    const authError = requireAdmin(currentUser);
    
    if (authError) {
      return NextResponse.json(
        { ok: false, message: authError.error },
        { status: authError.status }
      );
    }

    // Get all users who have audit log entries
    const usersWithLogs = await prisma.auditLog.groupBy({
      by: ['userId'],
      where: {
        userId: { not: null }
      }
    });

    const userIds = usersWithLogs.map(u => u.userId).filter(id => id !== null) as number[];

    const users = await prisma.user.findMany({
      where: {
        id: { in: userIds }
      },
      select: {
        id: true,
        name: true,
        role: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    const formattedUsers = users.map(user => ({
      id: user.id.toString(),
      name: `${user.name} (${user.role})`
    }));

    return NextResponse.json({
      ok: true,
      users: [
        { id: 'all', name: 'All Users' },
        ...formattedUsers,
        { id: 'system', name: 'System' }
      ]
    });

  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { ok: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}