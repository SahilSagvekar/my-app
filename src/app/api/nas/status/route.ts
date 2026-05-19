export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser2 } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role?.toLowerCase() !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    const [logs, totalFiles, archivedFiles] = await Promise.all([
      prisma.nasSyncLog.findMany({
        orderBy: { completedAt: 'desc' },
        take: 20,
      }),
      prisma.file.count(),
      prisma.file.count({ where: { archivedToNas: true } }),
    ]);

    return NextResponse.json({
      logs: logs.map(l => ({
        ...l,
        bytesCount: l.bytesCount ? Number(l.bytesCount) : null,
      })),
      stats: {
        totalFiles,
        archivedFiles,
        pendingFiles: totalFiles - archivedFiles,
        lastSync: logs[0]
          ? { ...logs[0], bytesCount: logs[0].bytesCount ? Number(logs[0].bytesCount) : null }
          : null,
      },
    });
  } catch (err: any) {
    console.error('[NAS Status]', err.message);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}