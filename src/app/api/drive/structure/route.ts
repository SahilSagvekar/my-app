export const dynamic = 'force-dynamic';
// src/app/api/drive/structure/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { client as clientTable, user as userTable, editorClientPermission, task as taskTable } from '@/lib/db/schema';
import { and, eq, isNotNull } from 'drizzle-orm';
import { getStructure } from '@/lib/file-server';

export async function GET(request: NextRequest) {
  const db = getDbHttp();
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
    const role = searchParams.get('role') || 'admin';
    const userId = searchParams.get('userId') || '0';

    console.log('🔍 Drive structure request:', { clientId, role, userId });

    let prefix = '';

    if (role === 'client') {
      let clientRecord = null;

      if (clientId) {
        const [row] = await db
          .select({ companyName: clientTable.companyName, name: clientTable.name })
          .from(clientTable)
          .where(eq(clientTable.id, clientId))
          .limit(1);
        clientRecord = row ?? null;
      } else if (userId) {
        const foundUser = await db.query.user.findFirst({
          where: eq(userTable.id, parseInt(userId)),
          columns: { email: true, linkedClientId: true },
          with: { client: { columns: { companyName: true, name: true } } },
        });
        if (foundUser?.client) {
          clientRecord = foundUser.client;
        } else if (foundUser?.email) {
          const [row] = await db
            .select({ companyName: clientTable.companyName, name: clientTable.name })
            .from(clientTable)
            .where(eq(clientTable.email, foundUser.email))
            .limit(1);
          clientRecord = row ?? null;
        }
        if (!clientRecord) {
          const [row] = await db
            .select({ companyName: clientTable.companyName, name: clientTable.name })
            .from(clientTable)
            .where(eq(clientTable.userId, parseInt(userId)))
            .limit(1);
          clientRecord = row ?? null;
        }
      }

      if (!clientRecord) {
        return NextResponse.json({ error: 'Client not found', code: 'CLIENT_NOT_LINKED' }, { status: 404 });
      }
      const companyName = clientRecord.companyName || clientRecord.name;
      prefix = `${companyName}/`;

    } else if (role === 'admin' || role === 'manager' || role === 'scheduler') {
      // Admin/manager must pass a clientId — file server blocks empty-prefix scans
      if (clientId) {
        const [clientRecord] = await db
          .select({ companyName: clientTable.companyName, name: clientTable.name })
          .from(clientTable)
          .where(eq(clientTable.id, clientId))
          .limit(1);
        if (clientRecord) {
          prefix = `${clientRecord.companyName || clientRecord.name}/`;
        }
      }
      // No clientId = prefix stays '' = file server returns empty root (show "select a client")

    } else if (role === 'editor') {
      const editorId = parseInt(userId);

      // If a specific clientId is passed (editor selected a client), use it directly
      if (clientId) {
        const [clientRecord] = await db
          .select({ companyName: clientTable.companyName, name: clientTable.name })
          .from(clientTable)
          .where(eq(clientTable.id, clientId))
          .limit(1);
        if (clientRecord) {
          prefix = `${clientRecord.companyName || clientRecord.name}/`;
        }
      } else {
        // Derive from assigned tasks/permissions
        const permissions = await db.query.editorClientPermission.findMany({
          where: eq(editorClientPermission.editorId, editorId),
          with: { client: { columns: { companyName: true, name: true } } },
        });
        const permNames = permissions.map(p => p.client.companyName || p.client.name).filter(Boolean);
        const taskClients = await db.query.task.findMany({
          where: and(eq(taskTable.assignedTo, editorId), isNotNull(taskTable.clientId)),
          with: { client: { columns: { companyName: true, name: true } } },
        });
        const taskNames = taskClients.map(t => t.client?.companyName || t.client?.name || '').filter(Boolean);
        const assigned = [...new Set([...permNames, ...taskNames])];
        // Only auto-scope if exactly one client — otherwise wait for selector
        prefix = assigned.length === 1 ? `${assigned[0]}/` : '';
      }
    }

    const tree = await getStructure(userId, role, prefix);
    return NextResponse.json(tree);

  } catch (error: any) {
    console.error('❌ Structure error:', error);
    return NextResponse.json({ error: 'Failed to fetch structure', details: error.message }, { status: 500 });
  }
}