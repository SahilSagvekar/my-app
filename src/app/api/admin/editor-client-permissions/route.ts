export const dynamic = 'force-dynamic';
// src/app/api/admin/editor-client-permissions/route.ts
//
// GET  - list all editors with their permitted clients
// POST - grant permission  { editorId: number, clientId: string }
// DELETE - revoke permission { editorId: number, clientId: string }
//
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
    user as userTable,
    client as clientTable,
    editorClientPermission as editorClientPermissionTable,
} from '@/lib/db/schema';
import { and, or, eq, asc, sql as drizzleSql } from 'drizzle-orm';
import { createId } from '@/lib/db/id';
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
        const editors = await db.query.user.findMany({
            where: or(eq(userTable.role, 'editor' as any), drizzleSql`${userTable.roles} @> ARRAY['editor']`),
            columns: { id: true, name: true, email: true, image: true },
            with: {
                editorClientPermissions: {
                    columns: { clientId: true, id: true },
                },
            },
            orderBy: asc(userTable.name),
        });

        // Fetch all clients (for the admin dropdown)
        const clients = await db.select({ id: clientTable.id, name: clientTable.name, companyName: clientTable.companyName })
            .from(clientTable)
            .where(eq(clientTable.status, 'active'))
            .orderBy(asc(clientTable.name));

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
        const [editor] = await db.select().from(userTable)
            .where(and(
                eq(userTable.id, Number(editorId)),
                or(eq(userTable.role, 'editor' as any), drizzleSql`${userTable.roles} @> ARRAY['editor']`)
            ))
            .limit(1);
        if (!editor) {
            return NextResponse.json({ error: 'Editor not found' }, { status: 404 });
        }

        // Upsert — safe to call if already exists
        await db.insert(editorClientPermissionTable)
            .values({ id: createId(), editorId: Number(editorId), clientId })
            .onConflictDoNothing({ target: [editorClientPermissionTable.editorId, editorClientPermissionTable.clientId] });

        const [permission] = await db.select().from(editorClientPermissionTable)
            .where(and(eq(editorClientPermissionTable.editorId, Number(editorId)), eq(editorClientPermissionTable.clientId, clientId)))
            .limit(1);

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

        await db.delete(editorClientPermissionTable)
            .where(and(eq(editorClientPermissionTable.editorId, Number(editorId)), eq(editorClientPermissionTable.clientId, clientId)));

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('[editor-client-permissions] DELETE error:', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}