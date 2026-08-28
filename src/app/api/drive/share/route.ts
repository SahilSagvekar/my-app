export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getDbHttp } from '@/lib/db';
import { shareableFile, shareRecipient, user } from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { randomBytes } from 'crypto';
import { eq } from 'drizzle-orm';
import { sendShareInviteEmail } from '@/lib/email';

function getTokenFromCookies(req: Request) {
    const cookieHeader = req.headers.get("cookie");
    if (!cookieHeader) return null;
    const match = cookieHeader.match(/authToken=([^;]+)/);
    return match ? match[1] : null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const db = getDbHttp();
    try {
        const token = getTokenFromCookies(req);
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
        if (!decoded?.userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { s3Key: rawS3Key, fileName, fileSize, mimeType, type, recipients } = body;

        if (!rawS3Key) {
            return NextResponse.json({ error: 'S3 Key is required' }, { status: 400 });
        }

        // Collapse any accidental doubled slashes (e.g. a folder key that
        // already ended in "/" getting another "/" appended by a caller) —
        // a "..test//" prefix matches nothing in the bucket and silently
        // looks like an empty folder.
        const s3Key = rawS3Key.replace(/\/{2,}/g, '/');

        // Mandatory recipients — a share cannot be created without at least
        // one email. This is the actual enforcement point; the UI also
        // blocks it, but that alone would be trivially bypassable.
        const rawRecipients: string[] = Array.isArray(recipients) ? recipients : [];
        const cleanedRecipients = Array.from(
            new Set(
                rawRecipients
                    .map((e) => String(e).trim().toLowerCase())
                    .filter((e) => EMAIL_RE.test(e))
            )
        );

        if (cleanedRecipients.length === 0) {
            return NextResponse.json(
                { error: 'At least one recipient email is required to share' },
                { status: 400 }
            );
        }

        const isFolder = type === 'folder';
        const shareToken = randomBytes(24).toString('hex');
        const resolvedMimeType = isFolder ? 'application/x-directory' : mimeType;
        const shareId = createId();
        const now = new Date().toISOString();

        await db.insert(shareableFile).values({
            id: shareId,
            s3Key,
            fileName: fileName || s3Key.replace(/\/$/, '').split('/').pop() || (isFolder ? 'folder' : 'file'),
            fileSize: fileSize ? Number(fileSize) : null,
            mimeType: resolvedMimeType,
            shareToken,
            createdBy: Number(decoded.userId),
            isActive: true,
            expiresAt: null,
            updatedAt: now,
        });

        await db.insert(shareRecipient).values(
            cleanedRecipients.map((email) => ({
                id: createId(),
                shareId,
                email,
                status: 'invited' as const,
                updatedAt: now,
            }))
        );

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.headers.get('origin') || 'http://localhost:3000';
        const shareUrl = isFolder
            ? `${baseUrl}/shared/folder/${shareToken}`
            : `${baseUrl}/shared/file/${shareToken}`;

        // Best-effort — a failed invite email shouldn't fail share creation
        // (the recipient can always be resent an invite from the admin UI).
        const [sharer] = await db.select().from(user).where(eq(user.id, Number(decoded.userId))).limit(1);
        const sharerName = sharer?.name || decoded.email || 'A teammate';
        const displayName = fileName || (isFolder ? 'a folder' : 'a file');

        await Promise.allSettled(
            cleanedRecipients.map((email) =>
                sendShareInviteEmail({
                    to: email,
                    sharerName,
                    itemName: displayName,
                    itemType: isFolder ? 'folder' : 'file',
                    shareUrl,
                })
            )
        );

        return NextResponse.json({
            success: true,
            shareUrl,
            shareToken,
            recipients: cleanedRecipients,
            message: 'Share link generated and invites sent'
        });

    } catch (error: any) {
        console.error('Error in POST /api/drive/share:', error);
        if (error?.cause) console.error('Root cause:', error.cause);
        return NextResponse.json(
            { error: 'Failed to generate share link', details: error?.cause?.message || error.message },
            { status: 500 }
        );
    }
}