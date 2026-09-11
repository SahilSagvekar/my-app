export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { shootDetail as shootDetailTable, task as taskTable, user as userTable } from '@/lib/db/schema';
import { and, eq, desc, isNotNull } from 'drizzle-orm';
import { getCurrentUser2, resolveClientIdForUser } from '@/lib/auth';

// GET — the logged-in client's Production Log: a single chronological feed
// of shoot days, calls, meetings, and analytics reviews.
//
// Only "Shoot Days" are wired up for real right now, sourced from
// ShootDetail (see /areas/download-all... no — see the Production Log
// design handoff). Calls, Meetings, and Analytics Reviews have no backing
// data model yet — there's no table for logged calls/meetings with
// attendees + planned/actual duration, and no per-review record for
// analytics reviews (distinct from the monthly SocialAnalytics report
// data itself). Those three entry types are returned as empty arrays on
// purpose so the filter pills and "no entries yet" empty state are real
// and correct, rather than faked with placeholder rows.
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

    const rows = await db
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
    const entries = rows.map((row) => {
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

    return NextResponse.json({
      entries,
      // Not yet backed by real data — see comment above.
      unavailableTypes: ['call', 'meeting', 'analytics'],
    });
  } catch (error: unknown) {
    console.error('[Client Production Log] GET error:', error);
    return NextResponse.json({ error: 'Failed to load production log' }, { status: 500 });
  }
}