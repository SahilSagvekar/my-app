export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nasSyncLog, file as fileTable } from '@/lib/db/schema';
import { count, desc, eq } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role?.toLowerCase() !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    const [logs, totalFilesResult, archivedFilesResult] = await Promise.all([
      db.select().from(nasSyncLog).orderBy(desc(nasSyncLog.completedAt)).limit(20),
      db.select({ value: count() }).from(fileTable),
      db.select({ value: count() }).from(fileTable).where(eq(fileTable.archivedToNas, true)),
    ]);
    const totalFiles = totalFilesResult[0].value;
    const archivedFiles = archivedFilesResult[0].value;

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