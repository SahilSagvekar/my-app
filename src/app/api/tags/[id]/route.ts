export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { tag } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';

function getTokenFromCookies(req: Request) {
    const cookieHeader = req.headers.get('cookie');
    if (!cookieHeader) return null;
    const match = cookieHeader.match(/authToken=([^;]+)/);
    return match ? match[1] : null;
}

// DELETE /api/tags/[id] — admin only. Removes the tag entirely (cascades to
// _TagToTask, so it's untagged from every task it was on).
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const db = getDbHttp();
    try {
        const { id } = await params;

        const token = getTokenFromCookies(req);
        if (!token) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });

        let decoded: any;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET!);
        } catch {
            return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
        }

        const role = String(decoded?.role || '').toUpperCase();
        if (role !== 'ADMIN') {
            return NextResponse.json({ ok: false, message: 'Access denied. Admin only.' }, { status: 403 });
        }

        const [deleted] = await db.delete(tag).where(eq(tag.id, id)).returning();
        if (!deleted) {
            return NextResponse.json({ ok: false, message: 'Tag not found' }, { status: 404 });
        }

        return NextResponse.json({ ok: true, tag: deleted });
    } catch (err: any) {
        console.error('[DELETE /api/tags/[id]]', err);
        if (err?.cause) console.error('Root cause:', err.cause);
        return NextResponse.json({ ok: false, message: err?.cause?.message || 'Server error' }, { status: 500 });
    }
}