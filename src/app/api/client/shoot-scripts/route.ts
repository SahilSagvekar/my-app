export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { shootDetail as shootDetailTable, task as taskTable } from '@/lib/db/schema';
import { and, eq, desc } from 'drizzle-orm';
import { getCurrentUser2, resolveClientIdForUser } from '@/lib/auth';

// GET — the logged-in client's own shoots with a script that's been made
// visible ("sent"). Content is always current — sending doesn't snapshot
// it, so no separate re-send is needed after an edit.
export async function GET(req: NextRequest) {
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((user.role || '').toLowerCase() !== 'client') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const clientId = await resolveClientIdForUser(user.id);
    if (!clientId) {
      return NextResponse.json({ scripts: [] });
    }

    const rows = await db
      .select({
        taskId: taskTable.id,
        taskTitle: taskTable.title,
        shootDate: shootDetailTable.shootDate,
        location: shootDetailTable.location,
        scriptContent: shootDetailTable.scriptContent,
        scriptSentAt: shootDetailTable.scriptSentAt,
      })
      .from(shootDetailTable)
      .innerJoin(taskTable, eq(shootDetailTable.taskId, taskTable.id))
      .where(and(eq(taskTable.clientId, clientId), eq(shootDetailTable.scriptStatus, 'sent')))
      .orderBy(desc(shootDetailTable.shootDate));

    return NextResponse.json({ scripts: rows });
  } catch (error: any) {
    console.error('[Client Shoot Scripts] GET error:', error);
    return NextResponse.json({ error: 'Failed to load scripts' }, { status: 500 });
  }
}