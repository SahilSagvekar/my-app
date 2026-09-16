// src/app/api/editor/task-permissions/route.ts
// Returns the list of clients for which the calling editor can create one-off tasks —
// from explicit EditorClientPermission grants plus any client they already have an
// assigned task for. Previously used a raw Prisma call (prisma.editorClientPermission),
// which isn't available on this app's Workers/Drizzle-only runtime and silently failed,
// always returning clients: [] to the caller. Rewritten on Drizzle to match the working
// /api/editor/clients route.
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser2 } from '@/lib/auth';
import { getDbHttp } from '@/lib/db';
import { editorClientPermission, task, client as clientTable } from '@/lib/db/schema';
import { and, eq, isNotNull } from 'drizzle-orm';

export async function GET(req: NextRequest) {
    const db = getDbHttp();
    try {
        const user = await getCurrentUser2(req);

        // Ensure user exists and has the editor role (checks DB state) — either as
        // their primary role or as one of their additional roles[] for multi-role accounts
        const isEditor = user && (user.role === 'editor' || (user as any).roles?.includes('editor'));
        if (!isEditor) {
            return NextResponse.json({ clients: [] });
        }

        const editorId = user.id;

        const permissions = await db.query.editorClientPermission.findMany({
            where: eq(editorClientPermission.editorId, editorId),
            columns: {},
            with: {
                client: { columns: { id: true, name: true, companyName: true } },
            },
        });

        const taskClients = await db.selectDistinct({
            client: {
                id: clientTable.id,
                name: clientTable.name,
                companyName: clientTable.companyName,
            },
        }).from(task)
            .innerJoin(clientTable, eq(task.clientId, clientTable.id))
            .where(and(eq(task.assignedTo, editorId), isNotNull(task.clientId)));

        const seen = new Set<string>();
        const clients: { id: string; name: string }[] = [];

        for (const p of permissions) {
            if (p.client && !seen.has(p.client.id)) {
                seen.add(p.client.id);
                clients.push({ id: p.client.id, name: p.client.companyName || p.client.name });
            }
        }
        for (const t of taskClients) {
            if (t.client && !seen.has(t.client.id)) {
                seen.add(t.client.id);
                clients.push({ id: t.client.id, name: t.client.companyName || t.client.name });
            }
        }

        clients.sort((a, b) => a.name.localeCompare(b.name));

        return NextResponse.json({ clients });
    } catch (err) {
        console.error('[editor/task-permissions] error:', err);
        return NextResponse.json({ clients: [] });
    }
}