// src/app/api/production-log/route.ts
//
// Videographer/admin/manager Production Log: ONE combined feed across every
// client (not scoped per-client, unlike the client-portal version at
// /api/client/production-log) — Shoot Day rows computed live from
// ShootDetail/Task, plus Call/Meeting/Analytics Review rows from LogEntry.

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq, isNotNull } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';
import { getDbHttp } from '@/lib/db';
import {
  shootDetail as shootDetailTable,
  task as taskTable,
  client as clientTable,
  user as userTable,
  logEntry as logEntryTable,
} from '@/lib/db/schema';
import { createId } from '@/lib/db/id';

const CAN_VIEW = ['admin', 'manager', 'videographer'];
const CAN_CREATE = ['admin', 'manager', 'videographer'];

async function authorize(req: NextRequest, allowed: string[]) {
  const user = await getCurrentUser2(req);
  if (!user) return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!allowed.includes((user.role || '').toLowerCase())) {
    return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { user };
}

export async function GET(req: NextRequest) {
  const auth = await authorize(req, CAN_VIEW);
  if ('response' in auth) return auth.response;

  const db = getDbHttp();
  try {
    const shootRows = await db
      .select({
        taskId: shootDetailTable.taskId,
        taskTitle: taskTable.title,
        taskStatus: taskTable.status,
        clientId: taskTable.clientId,
        clientName: clientTable.companyName,
        clientNameFallback: clientTable.name,
        shootDate: shootDetailTable.shootDate,
        location: shootDetailTable.location,
        videographerNotes: shootDetailTable.videographerNotes,
        videographerName: userTable.name,
        plannedStartTime: shootDetailTable.plannedStartTime,
        plannedEndTime: shootDetailTable.plannedEndTime,
        actualStartTime: shootDetailTable.actualStartTime,
        actualEndTime: shootDetailTable.actualEndTime,
      })
      .from(shootDetailTable)
      .innerJoin(taskTable, eq(shootDetailTable.taskId, taskTable.id))
      .leftJoin(clientTable, eq(taskTable.clientId, clientTable.id))
      .leftJoin(userTable, eq(shootDetailTable.videographerId, userTable.id))
      .where(isNotNull(shootDetailTable.shootDate))
      .orderBy(desc(shootDetailTable.shootDate));

    const computeMinutes = (startStr: string | null, endStr: string | null): number | null => {
      if (!startStr || !endStr) return null;
      const start = new Date(startStr).getTime();
      const end = new Date(endStr).getTime();
      if (isNaN(start) || isNaN(end) || end <= start) return null;
      return Math.round((end - start) / (1000 * 60));
    };

    const now = Date.now();
    const shootEntries = shootRows.map((row) => {
      const shootTime = row.shootDate ? new Date(row.shootDate).getTime() : null;
      const completed = row.taskStatus === 'COMPLETED' || (shootTime !== null && shootTime < now);
      const plannedMinutes = computeMinutes(row.plannedStartTime, row.plannedEndTime);
      const actualMinutes = computeMinutes(row.actualStartTime, row.actualEndTime);

      return {
        id: `shoot-${row.taskId}`,
        type: 'shoot' as const,
        clientId: row.clientId,
        clientName: row.clientName || row.clientNameFallback,
        date: row.shootDate,
        title: row.taskTitle,
        location: row.location,
        attendees: row.videographerName ? [row.videographerName] : [],
        plannedMinutes,
        actualMinutes,
        status: completed ? 'Completed' : 'Planned',
        note: row.videographerNotes ? { label: 'Notes', body: row.videographerNotes } : null,
        editable: false, // shoots are edited via /api/shoots, not here
      };
    });

    const logRows = await db
      .select({
        id: logEntryTable.id,
        type: logEntryTable.type,
        clientId: logEntryTable.clientId,
        clientName: clientTable.companyName,
        clientNameFallback: clientTable.name,
        title: logEntryTable.title,
        date: logEntryTable.date,
        location: logEntryTable.location,
        attendees: logEntryTable.attendees,
        plannedMinutes: logEntryTable.plannedMinutes,
        actualMinutes: logEntryTable.actualMinutes,
        status: logEntryTable.status,
        noteLabel: logEntryTable.noteLabel,
        noteBody: logEntryTable.noteBody,
        reportFileUrl: logEntryTable.reportFileUrl,
        reportFileName: logEntryTable.reportFileName,
      })
      .from(logEntryTable)
      .leftJoin(clientTable, eq(logEntryTable.clientId, clientTable.id))
      .orderBy(desc(logEntryTable.date));

    const logEntries = logRows.map((row) => ({
      id: row.id,
      type: (row.type === 'ANALYTICS_REVIEW' ? 'analytics' : row.type.toLowerCase()) as 'call' | 'meeting' | 'analytics',
      clientId: row.clientId,
      clientName: row.clientName || row.clientNameFallback,
      date: row.date,
      title: row.title,
      location: row.location,
      attendees: row.attendees || [],
      plannedMinutes: row.plannedMinutes,
      actualMinutes: row.actualMinutes,
      status: row.status === 'COMPLETED' ? 'Completed' : 'Planned',
      note: row.noteBody ? { label: row.noteLabel || 'Notes', body: row.noteBody } : null,
      reportFile: row.reportFileUrl ? { url: row.reportFileUrl, name: row.reportFileName } : null,
      editable: true,
    }));

    const entries = [...shootEntries, ...logEntries].sort((a, b) => {
      const at = a.date ? new Date(a.date).getTime() : 0;
      const bt = b.date ? new Date(b.date).getTime() : 0;
      return bt - at;
    });

    return NextResponse.json({ entries });
  } catch (error: unknown) {
    console.error('[Production Log] GET error:', error);
    return NextResponse.json({ error: 'Failed to load production log' }, { status: 500 });
  }
}

// POST — create a manual Call / Meeting / Analytics Review entry.
export async function POST(req: NextRequest) {
  const auth = await authorize(req, CAN_CREATE);
  if ('response' in auth) return auth.response;

  const db = getDbHttp();
  try {
    const body = await req.json();
    const { clientId, type, title, date, location, attendees, plannedMinutes, status, noteLabel, noteBody, reportFileUrl, reportFileName } = body;

    const validTypes = ['CALL', 'MEETING', 'ANALYTICS_REVIEW'];
    if (!clientId || !validTypes.includes(type) || !date) {
      return NextResponse.json({ error: 'clientId, a valid type, and date are required' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const [created] = await db.insert(logEntryTable).values({
      id: createId(),
      clientId,
      type,
      title: title || null,
      date: new Date(date).toISOString(),
      location: location || null,
      attendees: Array.isArray(attendees) ? attendees : [],
      plannedMinutes: plannedMinutes != null ? Number(plannedMinutes) : null,
      status: status === 'COMPLETED' ? 'COMPLETED' : 'PLANNED',
      noteLabel: noteLabel || null,
      noteBody: noteBody || null,
      reportFileUrl: reportFileUrl || null,
      reportFileName: reportFileName || null,
      createdBy: auth.user.id,
      updatedAt: now,
    }).returning();

    return NextResponse.json({ entry: created }, { status: 201 });
  } catch (error: unknown) {
    console.error('[Production Log] POST error:', error);
    return NextResponse.json({ error: 'Failed to create log entry' }, { status: 500 });
  }
}
