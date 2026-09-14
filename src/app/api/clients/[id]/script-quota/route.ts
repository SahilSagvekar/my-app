// src/app/api/clients/[id]/script-quota/route.ts
//
// The shared script pool for a client's month, spanning ALL of that
// client's shoots — not a per-shoot cap. Design (locked with Sahil):
//   - totalPlanned = sum of the client's video-type Monthly Deliverables
//     (same "video" filter ShootingSchedulePage already uses for its
//     single-shoot auto-fill — Hard Posts etc. excluded on purpose).
//   - completed = count of scripts marked completedAt across EVERY shoot
//     for this client, regardless of which shoot they were written on.
//   - remaining = totalPlanned - completed. Once a script is completed on
//     one shoot, every other shoot's remaining count drops immediately
//     (this is computed live on every request, never cached/stored).
//   - No rollover, no reminders: whatever's left unfilled at month-end
//     just stays a gap. This route always looks at monthFolder as given —
//     nothing here decides when a month "ends".

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { and, eq, isNotNull } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';
import { getDbHttp } from '@/lib/db';
import { client as clientTable, task as taskTable, shootDetail as shootDetailTable, monthlyDeliverable as monthlyDeliverableTable } from '@/lib/db/schema';
import { readShootScriptDocument } from '@/lib/shoot-scripts';

function currentMonthFolder(): string {
  const now = new Date();
  return `${now.toLocaleDateString('en-US', { month: 'long' })}-${now.getFullYear()}`;
}

const CAN_VIEW = ['admin', 'manager', 'videographer'];

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser2(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!CAN_VIEW.includes((user.role || '').toLowerCase())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: clientId } = await props.params;
  const { searchParams } = new URL(req.url);
  const monthFolder = searchParams.get('monthFolder') || currentMonthFolder();

  const db = getDbHttp();
  try {
    // Same "video" filter as ShootingSchedulePage's existing per-shoot
    // auto-fill — Short Form / Long Form count, Hard Posts etc. don't.
    const deliverables = await db.select({ type: monthlyDeliverableTable.type, quantity: monthlyDeliverableTable.quantity })
      .from(monthlyDeliverableTable).where(eq(monthlyDeliverableTable.clientId, clientId));
    const videoDeliverables = deliverables.filter((d) => /video/i.test(d.type || ''));
    const source = videoDeliverables.length > 0 ? videoDeliverables : deliverables;
    const totalPlanned = source.reduce((sum, d) => sum + (d.quantity || 0), 0);

    // Every shoot this client has (shoots aren't tagged with monthFolder
    // themselves, so — matching the rest of this feature — "this month"
    // means scripts actually completed within the given month, not which
    // month the shoot task was created in).
    const shoots = await db.select({ scriptContent: shootDetailTable.scriptContent })
      .from(shootDetailTable)
      .innerJoin(taskTable, eq(shootDetailTable.taskId, taskTable.id))
      .where(eq(taskTable.clientId, clientId));

    const [monthName, yearStr] = monthFolder.split('-');
    const year = parseInt(yearStr, 10);
    const monthIndex = new Date(`${monthName} 1, ${year}`).getMonth();

    let completed = 0;
    for (const s of shoots) {
      const doc = readShootScriptDocument(s.scriptContent);
      for (const script of doc.scripts) {
        if (!script.completedAt) continue;
        const d = new Date(script.completedAt);
        if (d.getFullYear() === year && d.getMonth() === monthIndex) completed++;
      }
    }

    return NextResponse.json({
      monthFolder,
      totalPlanned,
      completed,
      remaining: Math.max(0, totalPlanned - completed),
    });
  } catch (error: unknown) {
    console.error('[Script Quota] GET error:', error);
    return NextResponse.json({ error: 'Failed to load script quota' }, { status: 500 });
  }
}
