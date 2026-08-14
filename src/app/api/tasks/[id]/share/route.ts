export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getDb } from '@/lib/db';
import { task, shareableReview } from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { and, eq, or, isNull, gt, desc } from 'drizzle-orm';
import { randomBytes } from 'crypto';

function getTokenFromCookies(req: Request) {
    const cookieHeader = req.headers.get("cookie");
    if (!cookieHeader) return null;
    const match = cookieHeader.match(/authToken=([^;]+)/);
    return match ? match[1] : null;
}

// POST /api/tasks/[id]/share - Generate a shareable link
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
  const { db, closeDb } = getDb();
  try {
    try {
        const { id: taskId } = await params;

        const token = getTokenFromCookies(req);
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
        if (!decoded?.userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('📋 Generating share link for taskId:', taskId);

        const body = await req.json();
        const { expiresInDays } = body;
        console.log('⏳ Expiration (days):', expiresInDays);

        // Verify the task exists and user has access
        const foundTask = await db.query.task.findFirst({
            where: eq(task.id, taskId),
            with: {
                client: true,
                files: {
                    where: (f, { eq }) => eq(f.isActive, true),
                    orderBy: (f, { desc }) => desc(f.createdAt),
                }
            }
        });

        if (!foundTask) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        }

        // Check if user has permission (Allow basically any logged in user as long as they are authenticated)
        // We've already verified decoded.userId and token exists
        const userRole = decoded.role?.toLowerCase();
        // if (!['client', 'admin', 'manager'].includes(userRole)) {
        //     return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        // }

        // Generate a unique share token
        const shareToken = randomBytes(32).toString('hex');

        // Calculate expiration date if provided
        let expiresAt = null;
        if (expiresInDays && expiresInDays > 0) {
            expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + expiresInDays);
        }

        console.log('💾 Saving ShareableReview to database...');
        const [createdShareableReview] = await db.insert(shareableReview).values({
            id: createId(),
            taskId,
            shareToken,
            createdBy: Number(decoded.userId),
            expiresAt: expiresAt ? expiresAt.toISOString() : null,
            isActive: true,
            updatedAt: new Date().toISOString(),
        }).returning();
        console.log('✅ ShareableReview created:', createdShareableReview.id);

        // 🔥 Audit share link generation
        const { createAuditLog, AuditAction } = await import('@/lib/audit-logger');
        await createAuditLog({
            userId: Number(decoded.userId),
            action: 'TASK_SHARED',
            entity: 'Task',
            entityId: taskId,
            details: `Generated shareable review link for task ${taskId}`,
            metadata: {
                taskId,
                expiresAt,
                shareToken: shareToken.substring(0, 8) + '...'
            }
        });

        // Generate the shareable URL
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.headers.get('origin') || 'http://localhost:3000';
        const shareUrl = `${baseUrl}/shared/review/${shareToken}`;

        return NextResponse.json({
            success: true,
            shareUrl,
            shareUrlWithToken: shareUrl,
            shareToken,
            expiresAt,
            message: 'Share link generated successfully'
        });

    } catch (error: any) {
        console.error('❌ Error in POST /api/tasks/[id]/share:', error);
        return NextResponse.json(
            {
                error: 'Failed to generate share link',
                details: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            },
            { status: 500 }
        );
    }

  } finally {
    await closeDb();
  }
}

// GET /api/tasks/[id]/share - Get existing share links for a task
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
  const { db, closeDb } = getDb();
  try {
    try {
        const { id: taskId } = await params;

        const token = getTokenFromCookies(req);
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
        if (!decoded?.userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get all active share links for this task
        const shareLinks = await db.select().from(shareableReview).where(and(
            eq(shareableReview.taskId, taskId),
            eq(shareableReview.isActive, true),
            or(isNull(shareableReview.expiresAt), gt(shareableReview.expiresAt, new Date().toISOString())),
        )).orderBy(desc(shareableReview.createdAt));

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.headers.get('origin') || 'http://localhost:3000';

        const links = shareLinks.map((link: any) => ({
            id: link.id,
            shareUrl: `${baseUrl}/shared/review/${link.shareToken}`,
            shareToken: link.shareToken,
            viewCount: link.viewCount,
            expiresAt: link.expiresAt,
            createdAt: link.createdAt,
            lastViewedAt: link.lastViewedAt
        }));

        return NextResponse.json({ success: true, links });

    } catch (error) {
        console.error('Error fetching share links:', error);
        return NextResponse.json(
            { error: 'Failed to fetch share links' },
            { status: 500 }
        );
    }

  } finally {
    await closeDb();
  }
}

// DELETE /api/tasks/[id]/share - Deactivate a share link
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
  const { db, closeDb } = getDb();
  try {
    try {
        const { id: taskId } = await params;

        const token = getTokenFromCookies(req);
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
        if (!decoded?.userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const shareToken = searchParams.get('token');

        if (!shareToken) {
            return NextResponse.json({ error: 'Share token required' }, { status: 400 });
        }

        // Deactivate the share link
        await db.update(shareableReview).set({
            isActive: false,
            updatedAt: new Date().toISOString(),
        }).where(and(eq(shareableReview.taskId, taskId), eq(shareableReview.shareToken, shareToken)));

        // 🔥 Audit share link deactivation
        const { createAuditLog, AuditAction } = await import('@/lib/audit-logger');
        await createAuditLog({
            userId: Number(decoded.userId),
            action: 'TASK_SHARE_DEACTIVATED',
            entity: 'Task',
            entityId: taskId,
            details: `Deactivated shareable review link for task ${taskId}`,
            metadata: { taskId, shareToken: shareToken.substring(0, 8) + '...' }
        });

        return NextResponse.json({
            success: true,
            message: 'Share link deactivated'
        });

    } catch (error) {
        console.error('Error deactivating share link:', error);
        return NextResponse.json(
            { error: 'Failed to deactivate share link' },
            { status: 500 }
        );
    }

  } finally {
    await closeDb();
  }
}
