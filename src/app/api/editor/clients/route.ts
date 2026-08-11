// GET /api/editor/clients
// Returns all clients assigned to the current editor via permissions or tasks.
// Used by DriveExplorer to show client selector when editor has multiple clients.

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser2 } from '@/lib/auth';
import { db } from '@/lib/db';
import { editorClientPermission, task, client as clientTable } from '@/lib/db/schema';
import { and, eq, isNotNull } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const editorId = user.id;

    // Get clients from explicit permissions
    const permissions = await db.query.editorClientPermission.findMany({
      where: eq(editorClientPermission.editorId, editorId),
      columns: {},
      with: {
        client: { columns: { id: true, name: true, companyName: true } },
      },
    });

    // Get clients from assigned tasks
    const taskClients = await db.selectDistinct({
      client: {
        id: clientTable.id,
        name: clientTable.name,
        companyName: clientTable.companyName,
      },
    }).from(task)
      .innerJoin(clientTable, eq(task.clientId, clientTable.id))
      .where(and(eq(task.assignedTo, editorId), isNotNull(task.clientId)));

    // Merge and deduplicate by client id
    const seen = new Set<string>();
    const clients: { id: string; name: string; companyName: string | null }[] = [];

    for (const p of permissions) {
      if (p.client && !seen.has(p.client.id)) {
        seen.add(p.client.id);
        clients.push(p.client);
      }
    }
    for (const t of taskClients) {
      if (t.client && !seen.has(t.client.id)) {
        seen.add(t.client.id);
        clients.push(t.client);
      }
    }

    return NextResponse.json(
      clients.sort((a, b) =>
        (a.companyName || a.name).localeCompare(b.companyName || b.name)
      )
    );
  } catch (err: any) {
    console.error('[GET /api/editor/clients]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}