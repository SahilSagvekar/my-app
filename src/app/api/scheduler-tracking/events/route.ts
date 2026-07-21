export const dynamic = 'force-dynamic';

// src/app/api/scheduler-tracking/events/route.ts
//
// Ingests batched activity events from SchedulerActivityTracker.tsx.
// userId is ALWAYS derived from the authenticated session, never trusted
// from the request body — otherwise any scheduler could submit events
// under a different user's name.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser2 } from '@/lib/auth';
import type { SchedulerActivityEventInput } from '@/lib/scheduler-activity-shared';

const VALID_EVENT_TYPES = new Set([
  'session_start', 'session_end', 'click', 'navigation',
  'idle_start', 'idle_end', 'visibility_hidden', 'visibility_visible',
]);

const MAX_BATCH_SIZE = 200; // guards against a malformed/malicious oversized payload

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Server-side enforcement — this is the actual gate, not the client
    // component's role check (which is just to avoid attaching listeners
    // for everyone else; it's not a security boundary on its own).
    if (user.role?.toLowerCase() !== 'scheduler') {
      return NextResponse.json({ error: 'Not applicable to this role' }, { status: 403 });
    }

    let body: { events?: SchedulerActivityEventInput[] };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const events = Array.isArray(body.events) ? body.events : [];
    if (events.length === 0) {
      return NextResponse.json({ ok: true, inserted: 0 });
    }
    if (events.length > MAX_BATCH_SIZE) {
      return NextResponse.json({ error: `Batch too large (max ${MAX_BATCH_SIZE})` }, { status: 400 });
    }

    const rows = events
      .filter((e) => e && VALID_EVENT_TYPES.has(e.eventType) && typeof e.sessionId === 'string')
      .map((e) => ({
        userId: user.id,
        sessionId: e.sessionId,
        eventType: e.eventType,
        path: e.path?.slice(0, 500) || null,
        targetLabel: e.targetLabel?.slice(0, 200) || null,
        targetTag: e.targetTag?.slice(0, 50) || null,
        metadata: e.metadata ? (e.metadata as any) : undefined,
        timestamp: e.timestamp ? new Date(e.timestamp) : new Date(),
      }));

    if (rows.length === 0) {
      return NextResponse.json({ ok: true, inserted: 0 });
    }

    const result = await prisma.schedulerActivityEvent.createMany({ data: rows });
    return NextResponse.json({ ok: true, inserted: result.count });
  } catch (err: any) {
    console.error('[scheduler-tracking/events] error:', err.message);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}