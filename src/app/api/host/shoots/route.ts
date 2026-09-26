export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq, inArray, isNotNull } from 'drizzle-orm';
import { getDbHttp } from '@/lib/db';
import { client as clientTable, shootDetail, task as taskTable, user as userTable } from '@/lib/db/schema';
import { getCurrentUser2 } from '@/lib/auth';
import { canViewAllHosts, hasHostRole } from '@/lib/host-portal';

// Host Portal — "My Shoots".
//
// E8 assigns hosts directly (no accept/decline), so this only ever returns
// bookings that are already decided:
//   confirmed  — upcoming, not cancelled
//   completed  — the shoot has happened (marked complete, or its end time passed)
//   cancelled  — cancelled by E8 or the client
//
// PRIVACY: a host only ever reads their OWN shoots. The host id always comes
// from the signed-in session — never from the request — except for admins /
// managers, who may pass ?hostId= to preview a host's portal (omit it to see
// every assigned shoot). Internal videographer notes are never returned; the
// host sees only ShootDetail.hostNotes.

export async function GET(req: NextRequest) {
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    const isHost = hasHostRole(user);
    const isStaff = canViewAllHosts(user);
    if (!isHost && !isStaff) {
      return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });
    }

    // Who are we listing shoots for?
    //  - host (non-staff): always themselves, any query param is ignored.
    //  - admin/manager who is ALSO a host: their own bookings by default.
    //  - admin/manager who is not a host: every host's bookings (preview).
    //  - staff may pass ?hostId=<id> for one host, or ?hostId=all for everyone.
    let scopeHostId: number | null;
    let preview = false;
    if (!isStaff) {
      scopeHostId = user.id;
    } else {
      const requested = new URL(req.url).searchParams.get('hostId');
      if (requested === 'all') {
        scopeHostId = null;
        preview = true;
      } else if (requested) {
        scopeHostId = Number(requested);
        preview = true;
        if (!Number.isFinite(scopeHostId)) {
          return NextResponse.json({ ok: false, message: 'Invalid hostId' }, { status: 400 });
        }
      } else if (isHost) {
        scopeHostId = user.id;
      } else {
        scopeHostId = null;
        preview = true;
      }
    }

    const rows = await db
      .select({
        shoot: shootDetail,
        taskStatus: taskTable.status,
        taskTitle: taskTable.title,
        client: { name: clientTable.name, companyName: clientTable.companyName },
      })
      .from(shootDetail)
      .innerJoin(taskTable, eq(shootDetail.taskId, taskTable.id))
      .leftJoin(clientTable, eq(taskTable.clientId, clientTable.id))
      // Unscheduled shoots (e.g. the auto-created replacement for a cancelled shoot, which has no date
      // until it is rebooked) are not bookings yet, so they are not shown to the host.
      .where(and(
        scopeHostId !== null ? eq(shootDetail.hostId, scopeHostId) : isNotNull(shootDetail.hostId),
        isNotNull(shootDetail.shootDate)
      ))
      .orderBy(desc(shootDetail.shootDate));

    // Names for the videographer / host columns — one small lookup instead of aliased self-joins.
    const userIds = [...new Set(rows.flatMap((r) => [r.shoot.videographerId, r.shoot.hostId]).filter((v): v is number => typeof v === 'number'))];
    const nameById = new Map<number, string>();
    if (userIds.length > 0) {
      const people = await db.select({ id: userTable.id, name: userTable.name }).from(userTable).where(inArray(userTable.id, userIds));
      for (const p of people) nameById.set(p.id, p.name || '');
    }

    const now = Date.now();
    const HALF_DAY = 12 * 60 * 60 * 1000;

    const confirmed: any[] = [];
    const past: any[] = [];

    for (const r of rows) {
      const s = r.shoot;
      const start = s.shootDate ? new Date(s.shootDate).getTime() : null;
      // A shoot counts as "over" once its planned end has passed; with no end time, 12h after the call.
      const plannedEnd = s.plannedEndTime ? new Date(s.plannedEndTime).getTime() : start !== null ? start + HALF_DAY : null;
      const cancelled = !!s.cancelledAt || r.taskStatus === 'CANCELLED';
      const happened = !!s.actualEndTime || r.taskStatus === 'COMPLETED' || (plannedEnd !== null && plannedEnd < now);
      const status: 'confirmed' | 'completed' | 'cancelled' = cancelled ? 'cancelled' : happened ? 'completed' : 'confirmed';

      const row = {
        id: s.taskId,
        status,
        clientName: r.client?.companyName || r.client?.name || r.taskTitle || 'Shoot',
        shootDate: s.shootDate,
        callTime: s.plannedStartTime || s.shootDate,
        endTime: s.plannedEndTime,
        location: s.location,
        role: s.hostRole,
        wardrobe: s.hostWardrobe,
        videographer: (s.videographerId && nameById.get(s.videographerId)) || null,
        rate: s.hostRate, // numeric string, e.g. "450.00"
        notes: s.hostNotes,
        // Only meaningful for the staff preview (a host is always looking at themselves).
        hostId: s.hostId,
        hostName: (s.hostId && nameById.get(s.hostId)) || null,
      };

      (status === 'confirmed' ? confirmed : past).push(row);
    }

    // Upcoming: soonest first. Past/cancelled: most recent first (already ordered desc by the query).
    confirmed.sort((a, b) => new Date(a.shootDate || 0).getTime() - new Date(b.shootDate || 0).getTime());

    return NextResponse.json({ ok: true, confirmed, past, preview });
  } catch (err: any) {
    console.error('GET /api/host/shoots error:', err);
    return NextResponse.json({ ok: false, message: 'Failed to load shoots' }, { status: 500 });
  }
}
