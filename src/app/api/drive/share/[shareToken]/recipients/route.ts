export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getDbHttp } from '@/lib/db';
import { shareableFile, shareRecipient, user } from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { and, eq } from 'drizzle-orm';
import { sendShareInviteEmail } from '@/lib/email';

function getTokenFromCookies(req: Request) {
    const cookieHeader = req.headers.get('cookie');
    if (!cookieHeader) return null;
    const match = cookieHeader.match(/authToken=([^;]+)/);
    return match ? match[1] : null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function requireOwnedShare(req: NextRequest, shareToken: string) {
    const db = getDbHttp();
    const token = getTokenFromCookies(req);
    if (!token) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

    let decoded: any;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET!);
    } catch {
        return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }
    if (!decoded?.userId) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

    const [share] = await db.select().from(shareableFile).where(eq(shareableFile.shareToken, shareToken)).limit(1);
    if (!share) return { error: NextResponse.json({ error: 'Share not found' }, { status: 404 }) };
    if (share.createdBy !== Number(decoded.userId)) {
        return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
    }

    return { db, share, decoded };
}

// GET — list recipients for a share the caller owns
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ shareToken: string }> }
) {
    try {
        const { shareToken } = await params;
        const result = await requireOwnedShare(req, shareToken);
        if ('error' in result) return result.error;
        const { db, share } = result;

        const recipients = await db
            .select()
            .from(shareRecipient)
            .where(eq(shareRecipient.shareId, share.id));

        return NextResponse.json({ ok: true, recipients });
    } catch (err: any) {
        console.error('[GET recipients]', err);
        return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
    }
}

// POST — add more recipients to an existing share (sends invites only to new emails)
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ shareToken: string }> }
) {
    try {
        const { shareToken } = await params;
        const result = await requireOwnedShare(req, shareToken);
        if ('error' in result) return result.error;
        const { db, share, decoded } = result;

        const body = await req.json();
        const rawRecipients: string[] = Array.isArray(body.recipients) ? body.recipients : [];
        const cleaned = Array.from(
            new Set(rawRecipients.map((e) => String(e).trim().toLowerCase()).filter((e) => EMAIL_RE.test(e)))
        );
        if (cleaned.length === 0) {
            return NextResponse.json({ error: 'At least one valid email is required' }, { status: 400 });
        }

        const existing = await db
            .select()
            .from(shareRecipient)
            .where(eq(shareRecipient.shareId, share.id));
        const existingEmails = new Set(existing.map((r) => r.email));
        const newEmails = cleaned.filter((e) => !existingEmails.has(e));

        if (newEmails.length === 0) {
            return NextResponse.json({ ok: true, added: [], message: 'All recipients already have access' });
        }

        const now = new Date().toISOString();
        await db.insert(shareRecipient).values(
            newEmails.map((email) => ({
                id: createId(),
                shareId: share.id,
                email,
                status: 'invited' as const,
                updatedAt: now,
            }))
        );

        const [sharer] = await db.select().from(user).where(eq(user.id, Number(decoded.userId))).limit(1);
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.headers.get('origin') || 'http://localhost:3000';
        const isFolder = share.mimeType === 'application/x-directory';
        const shareUrl = isFolder
            ? `${baseUrl}/shared/folder/${shareToken}`
            : `${baseUrl}/shared/file/${shareToken}`;

        await Promise.allSettled(
            newEmails.map((email) =>
                sendShareInviteEmail({
                    to: email,
                    sharerName: sharer?.name || 'A teammate',
                    itemName: share.fileName,
                    itemType: isFolder ? 'folder' : 'file',
                    shareUrl,
                })
            )
        );

        return NextResponse.json({ ok: true, added: newEmails });
    } catch (err: any) {
        console.error('[POST recipients]', err);
        return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
    }
}