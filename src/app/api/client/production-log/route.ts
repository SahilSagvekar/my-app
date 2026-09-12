export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { shootDetail as shootDetailTable, task as taskTable, user as userTable, logEntry as logEntryTable } from '@/lib/db/schema';
import { and, eq, desc, isNotNull } from 'drizzle-orm';
import { getCurrentUser2, resolveClientIdForUser } from '@/lib/auth';

// GET — the logged-in client's Production Log: a single chronological feed
// of shoot days, calls, meetings, and analytics reviews.
//
// Shoot Days are computed live from ShootDetail (a shoot is already its
// own record — no separate row needed). Calls, Meetings, and Analytics
// Reviews are now backed by the LogEntry table.
export async function GET(req: NextRequest) {
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if ((user.role || '').toLowerCase() !== 'client') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const clientId = await resolveClientIdForUser(user.id);
    if (!clientId) return NextResponse.json({ entries: [] });

    const shootRows = await db
      .select({
        taskId: shootDetailTable.taskId,
        taskTitle: taskTable.title,
        taskStatus: taskTable.status,
        shootDate: shootDetailTable.shootDate,
        location: shootDetailTable.location,
        videographerNotes: shootDetailTable.videographerNotes,
        videographerName: userTable.name,
      })
      .from(shootDetailTable)
      .innerJoin(taskTable, eq(shootDetailTable.taskId, taskTable.id))
      .leftJoin(userTable, eq(shootDetailTable.videographerId, userTable.id))
      .where(and(eq(taskTable.clientId, clientId), isNotNull(shootDetailTable.shootDate)))
      .orderBy(desc(shootDetailTable.shootDate));

    const now = Date.now();
    const shootEntries = shootRows.map((row) => {
      const shootTime = row.shootDate ? new Date(row.shootDate).getTime() : null;
      const completed = row.taskStatus === 'COMPLETED' || (shootTime !== null && shootTime < now);
      return {
        id: `shoot-${row.taskId}`,
        type: 'shoot' as const,
        date: row.shootDate,
        title: row.taskTitle,
        location: row.location,
        attendees: row.videographerName ? [row.videographerName] : [],
        // No duration field exists on ShootDetail today — surfaced as null
        // rather than a guessed number; the frontend renders "—" for this.
        plannedMinutes: null,
        actualMinutes: null,
        status: completed ? 'Completed' : 'Planned',
        note: row.videographerNotes ? { label: 'Notes', body: row.videographerNotes } : null,
      };
    });

    const logRows = await db
      .select()
      .from(logEntryTable)
      .where(eq(logEntryTable.clientId, clientId))
      .orderBy(desc(logEntryTable.date));

    const logEntries = logRows.map((row) => ({
      id: row.id,
      type: (row.type === 'ANALYTICS_REVIEW' ? 'analytics' : row.type.toLowerCase()) as 'call' | 'meeting' | 'analytics',
      date: row.date,
      title: row.title,
      location: row.location,
      attendees: row.attendees || [],
      plannedMinutes: row.plannedMinutes,
      actualMinutes: row.actualMinutes,
      status: row.status === 'COMPLETED' ? 'Completed' : 'Planned',
      note: row.noteBody ? { label: row.noteLabel || 'Notes', body: row.noteBody } : null,
      reportFile: row.reportFileUrl ? { url: row.reportFileUrl, name: row.reportFileName } : null,
    }));

    const entries = [...shootEntries, ...logEntries].sort((a, b) => {
      const at = a.date ? new Date(a.date).getTime() : 0;
      const bt = b.date ? new Date(b.date).getTime() : 0;
      return bt - at;
    });

    return NextResponse.json({ entries });
  } catch (error: unknown) {
    console.error('[Client Production Log] GET error:', error);
    return NextResponse.json({ error: 'Failed to load production log' }, { status: 500 });
  }
}
