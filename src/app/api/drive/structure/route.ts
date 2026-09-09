export const dynamic = 'force-dynamic';
// src/app/api/drive/structure/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { client as clientTable, user as userTable, editorClientPermission, task as taskTable } from '@/lib/db/schema';
import { and, eq, isNotNull } from 'drizzle-orm';
import { getStructure } from '@/lib/file-server';
import { getCloudflareContext } from '@opennextjs/cloudflare';

export async function GET(request: NextRequest) {
  const db = getDbHttp();
  const { env } = getCloudflareContext();
  console.log('api started')

  // Hoisted above the try block so the catch handler below can log them —
  // they were previously declared inside try, which would have thrown a
  // ReferenceError from inside catch instead of the intended error log.
  const { searchParams } = new URL(request.url);
  const rawClientId = searchParams.get('clientId');
  const role = searchParams.get('role') || 'admin';
  const userId = searchParams.get('userId') || '0';
  let prefix = '';

  try {
    // Defense in depth: a bad caller has, at least once in production,
    // sent a literal "[object Object]" string here (a JS object landed in
    // a URL param upstream). Treat any clientId that doesn't look like a
    // real ID as if none were provided, rather than querying the DB with
    // garbage and silently falling through to an empty-prefix scan.
    const clientId = rawClientId && !/^\[object /i.test(rawClientId) && rawClientId !== 'undefined' && rawClientId !== 'null'
      ? rawClientId
      : null;
    if (rawClientId && !clientId) {
      console.warn('⚠️  Rejected malformed clientId param:', rawClientId);
    }

    console.log('🔍 Drive structure request:', { clientId, role, userId });

    if (role === 'client') {
      let clientRecord = null;

      if (clientId) {
        const [row] = await db
          .select({ companyName: clientTable.companyName, name: clientTable.name })
          .from(clientTable)
          .where(eq(clientTable.id, clientId))
          .limit(1);
        clientRecord = row ?? null;

        console.log('📂 clientId provided, found clientRecord:', clientRecord);

      } else if (userId) {
        const foundUser = await db.query.user.findFirst({
          where: eq(userTable.id, parseInt(userId)),
          columns: { email: true, linkedClientId: true },
          with: { client: { columns: { companyName: true, name: true } } },
        });
        console.log('📂 userId provided, found user:', foundUser);

        if (foundUser?.client) {
          clientRecord = foundUser.client;
          console.log('📂 derived clientRecord from linked client:', clientRecord);

        } else if (foundUser?.email) {
          const [row] = await db
            .select({ companyName: clientTable.companyName, name: clientTable.name })
            .from(clientTable)
            .where(eq(clientTable.email, foundUser.email))
            .limit(1);
          clientRecord = row ?? null;
        }
        console.log('📂 derived clientRecord:', clientRecord);
        
        if (!clientRecord) {
          console.log('📂 no clientRecord found, checking userId:', userId);
          const [row] = await db
            .select({ companyName: clientTable.companyName, name: clientTable.name })
            .from(clientTable)
            .where(eq(clientTable.userId, parseInt(userId)))
            .limit(1);
          clientRecord = row ?? null;
        }
      }

      if (!clientRecord) {
        console.log('📂 no clientRecord found for userId:', userId);
        return NextResponse.json({ error: 'Client not found', code: 'CLIENT_NOT_LINKED' }, { status: 404 });
      }
      const companyName = clientRecord.companyName || clientRecord.name;
      prefix = `${companyName}/`;

      console.log('📂 client role, using prefix:', prefix, companyName);

    } else if (role === 'admin' || role === 'manager' || role === 'scheduler' || role === 'videographer') {
      // Admin/manager/videographer must pass a clientId — file server blocks empty-prefix scans
      if (clientId) {
        const [clientRecord] = await db
          .select({ companyName: clientTable.companyName, name: clientTable.name })
          .from(clientTable)
          .where(eq(clientTable.id, clientId))
          .limit(1);
        if (clientRecord) {
          prefix = `${clientRecord.companyName || clientRecord.name}/`;
          console.log('📂 admin/manager role, using prefix:', prefix);
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
          console.log('📂 editor role with clientId, using prefix:', prefix);
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
        console.log('📂 derived assigned clients:', assigned);
        prefix = assigned.length === 1 ? `${assigned[0]}/` : '';
      }
    }

    console.log('📂 userId, role, prefix:', userId, role, prefix);

    const tree = await getStructure(env, userId, role, prefix);

    console.log('✅ tree:', { tree });
    return NextResponse.json(tree);

  } catch (error: any) {
    console.error('❌ Structure error:', { clientId: rawClientId, role, userId, prefix, message: error?.message, stack: error?.stack });
    return NextResponse.json({
      error: 'Failed to fetch structure',
      details: error.message,
      stack: error.stack,
      cause: error.cause,
    }, { status: 500 });
  }
}