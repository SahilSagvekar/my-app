export const dynamic = 'force-dynamic';
// src/app/api/admin/editor-client-permissions/route.ts
//
// GET  - list all editors with their permitted clients
// POST - grant permission  { editorId: number, clientId: string }
// DELETE - revoke permission { editorId: number, clientId: string }
//
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

function getTokenFromCookies(req: Request) {
    const cookieHeader = req.headers.get('cookie');
    if (!cookieHeader) return null;
    const match = cookieHeader.match(/authToken=([^;]+)/);
    return match ? match[1] : null;
}

function verifyAdmin(req: Request) {
    const token = getTokenFromCookies(req);
    if (!token) return null;
    try {
        const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
        if (!decoded?.userId || decoded.role !== 'admin') return null;
        return decoded;
    } catch {
        return null;
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// GET: Return all editors (role=editor) + their permitted client IDs
// ──────────────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
    if (!verifyAdmin(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Fetch all editors
        const editors = await (prisma as any).user.findMany({
            where: { role: 'editor' },
            select: {
                id: true,
                name: true,
                email: true,
                image: true,
                editorClientPermissions: {
                    select: { clientId: true, id: true },
                },
            },
            orderBy: { name: 'asc' },
        });

        // Fetch all clients (for the admin dropdown)
        const clients = await prisma.client.findMany({
            where: { status: 'active' },
            select: { id: true, name: true, companyName: true },
            orderBy: { name: 'asc' },
        });

        return NextResponse.json({ editors, clients });
    } catch (err: any) {
        console.error('[editor-client-permissions] GET error:', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// POST: Grant an editor permission to create one-off tasks for a client
// ──────────────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
    if (!verifyAdmin(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { editorId, clientId } = await req.json();

        if (!editorId || !clientId) {
            return NextResponse.json({ error: 'editorId and clientId are required' }, { status: 400 });
        }

        // Verify editor exists with role=editor
        const editor = await prisma.user.findFirst({
            where: { id: Number(editorId), role: 'editor' },
        });
        if (!editor) {
            return NextResponse.json({ error: 'Editor not found' }, { status: 404 });
        }

        // Upsert — safe to call if already exists
        const permission = await (prisma as any).editorClientPermission.upsert({
            where: { editorId_clientId: { editorId: Number(editorId), clientId } },
            create: { editorId: Number(editorId), clientId },
            update: {},
        });

        return NextResponse.json({ success: true, permission });
    } catch (err: any) {
        console.error('[editor-client-permissions] POST error:', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// DELETE: Revoke permission
// ──────────────────────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
    if (!verifyAdmin(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { editorId, clientId } = await req.json();

        if (!editorId || !clientId) {
            return NextResponse.json({ error: 'editorId and clientId are required' }, { status: 400 });
        }

        await (prisma as any).editorClientPermission.deleteMany({
            where: { editorId: Number(editorId), clientId },
        });

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('[editor-client-permissions] DELETE error:', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
