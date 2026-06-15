// GET /api/editor/clients
// Returns all clients assigned to the current editor via permissions or tasks.
// Used by DriveExplorer to show client selector when editor has multiple clients.

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser2 } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const editorId = user.id;

    // Get clients from explicit permissions
    const permissions = await prisma.editorClientPermission.findMany({
      where: { editorId },
      select: {
        client: { select: { id: true, name: true, companyName: true } },
      },
    });

    // Get clients from assigned tasks
    const taskClients = await prisma.task.findMany({
      where: { assignedTo: editorId, clientId: { not: null } },
      select: {
        client: { select: { id: true, name: true, companyName: true } },
      },
      distinct: ['clientId'],
    });

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