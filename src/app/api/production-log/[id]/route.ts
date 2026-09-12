// src/app/api/production-log/[id]/route.ts
//
// Edit/delete a single manual LogEntry (Call/Meeting/Analytics Review).
// Shoot Day rows have no route here — they're not LogEntry rows, they're
// edited via /api/shoots/[id].

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';
import { getDbHttp } from '@/lib/db';
import { logEntry as logEntryTable } from '@/lib/db/schema';

const CAN_EDIT = ['admin', 'manager', 'videographer'];

async function authorize(req: NextRequest) {
  const user = await getCurrentUser2(req);
  if (!user) return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!CAN_EDIT.includes((user.role || '').toLowerCase())) {
    return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { user };
}

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const auth = await authorize(req);
  if ('response' in auth) return auth.response;
  const { id } = await props.params;

  const db = getDbHttp();
  try {
    const body = await req.json();
    const { title, date, location, attendees, plannedMinutes, actualMinutes, status, noteLabel, noteBody, reportFileUrl, reportFileName } = body;

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (title !== undefined) updates.title = title;
    if (date !== undefined) updates.date = new Date(date).toISOString();
    if (location !== undefined) updates.location = location;
    if (attendees !== undefined) updates.attendees = Array.isArray(attendees) ? attendees : [];
    if (plannedMinutes !== undefined) updates.plannedMinutes = plannedMinutes != null ? Number(plannedMinutes) : null;
    if (actualMinutes !== undefined) updates.actualMinutes = actualMinutes != null ? Number(actualMinutes) : null;
    if (status !== undefined) updates.status = status === 'COMPLETED' ? 'COMPLETED' : 'PLANNED';
    if (noteLabel !== undefined) updates.noteLabel = noteLabel;
    if (noteBody !== undefined) updates.noteBody = noteBody;
    if (reportFileUrl !== undefined) updates.reportFileUrl = reportFileUrl;
    if (reportFileName !== undefined) updates.reportFileName = reportFileName;

    const [updated] = await db.update(logEntryTable).set(updates).where(eq(logEntryTable.id, id)).returning();
    if (!updated) return NextResponse.json({ error: 'Log entry not found' }, { status: 404 });

    return NextResponse.json({ entry: updated });
  } catch (error: unknown) {
    console.error('[Production Log] PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update log entry' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const auth = await authorize(req);
  if ('response' in auth) return auth.response;
  const { id } = await props.params;

  const db = getDbHttp();
  try {
    const [deleted] = await db.delete(logEntryTable).where(eq(logEntryTable.id, id)).returning({ id: logEntryTable.id });
    if (!deleted) return NextResponse.json({ error: 'Log entry not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('[Production Log] DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete log entry' }, { status: 500 });
  }
}
