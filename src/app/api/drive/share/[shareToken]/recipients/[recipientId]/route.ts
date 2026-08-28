export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getDbHttp } from '@/lib/db';
import { shareableFile, shareRecipient } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';

function getTokenFromCookies(req: Request) {
    const cookieHeader = req.headers.get('cookie');
    if (!cookieHeader) return null;
    const match = cookieHeader.match(/authToken=([^;]+)/);
    return match ? match[1] : null;
}

// DELETE — revoke a single recipient's access to a share
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ shareToken: string; recipientId: string }> }
) {
    const db = getDbHttp();
    try {
        const { shareToken, recipientId } = await params;

        const token = getTokenFromCookies(req);
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        let decoded: any;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET!);
        } catch {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (!decoded?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const [share] = await db.select().from(shareableFile).where(eq(shareableFile.shareToken, shareToken)).limit(1);
        if (!share) return NextResponse.json({ error: 'Share not found' }, { status: 404 });
        if (share.createdBy !== Number(decoded.userId)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        await db
            .delete(shareRecipient)
            .where(and(eq(shareRecipient.id, recipientId), eq(shareRecipient.shareId, share.id)));

        return NextResponse.json({ ok: true });
    } catch (err: any) {
        console.error('[DELETE recipient]', err);
        return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
    }
}