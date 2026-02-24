// src/app/api/editor/task-permissions/route.ts
// Returns the list of clients for which the calling editor can create one-off tasks.
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser2 } from '@/lib/auth';

export async function GET(req: NextRequest) {
    try {
        const user = await getCurrentUser2(req);

        // Ensure user exists and has the editor role (checks DB state)
        if (!user || user.role !== 'editor') {
            return NextResponse.json({ clients: [] });
        }

        const permissions: any[] = await (prisma as any).editorClientPermission.findMany({
            where: { editorId: user.id },
            include: {
                client: { select: { id: true, name: true, companyName: true } },
            },
        });

        const clients = permissions.map((p: any) => ({
            id: p.client.id,
            name: p.client.companyName || p.client.name,
        }));

        return NextResponse.json({ clients });
    } catch (err) {
        console.error('[editor/task-permissions] error:', err);
        return NextResponse.json({ clients: [] });
    }
}

