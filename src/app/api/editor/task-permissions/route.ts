// src/app/api/editor/task-permissions/route.ts
// Returns the list of clients for which the calling editor can create one-off tasks.
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

export async function GET(req: NextRequest) {
    const cookieHeader = req.headers.get('cookie');
    const match = cookieHeader?.match(/authToken=([^;]+)/);
    const token = match ? match[1] : null;

    if (!token) {
        return NextResponse.json({ clients: [] }, { status: 401 });
    }

    try {
        const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
        if (!decoded?.userId || decoded.role !== 'editor') {
            return NextResponse.json({ clients: [] });
        }

        const permissions: any[] = await (prisma as any).editorClientPermission.findMany({
            where: { editorId: Number(decoded.userId) },
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
