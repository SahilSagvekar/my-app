import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
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
    { params }: { params: { id: string } }
) {
    try {
        const token = getTokenFromCookies(req);
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
        console.log('🔍 Decoded Token:', decoded);

        if (!decoded?.userId) {
            console.error('❌ No userId in decoded token');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id: taskId } = params;
        console.log('📋 Generating share link for taskId:', taskId);

        const body = await req.json();
        const { expiresInDays } = body;
        console.log('⏳ Expiration (days):', expiresInDays);

        // Verify the task exists and user has access
        const task = await prisma.task.findUnique({
            where: { id: taskId },
            include: {
                client: true,
                files: {
                    where: { isActive: true },
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        if (!task) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        }

        // Check if user has permission (QC, admin, or manager)
        const userRole = decoded.role;
        if (!['qc', 'admin', 'manager'].includes(userRole)) {
            return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }

        // Generate a unique share token
        const shareToken = randomBytes(32).toString('hex');

        // Calculate expiration date if provided
        let expiresAt = null;
        if (expiresInDays && expiresInDays > 0) {
            expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + expiresInDays);
        }

        console.log('💾 Saving ShareableReview to database...');
        const shareableReview = await prisma.shareableReview.create({
            data: {
                taskId,
                shareToken,
                createdBy: Number(decoded.userId),
                expiresAt,
                isActive: true,
            }
        });
        console.log('✅ ShareableReview created:', shareableReview.id);

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
}

// GET /api/tasks/[id]/share - Get existing share links for a task
export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const token = getTokenFromCookies(req);
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
        if (!decoded?.userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id: taskId } = params;

        // Get all active share links for this task
        const shareLinks = await prisma.shareableReview.findMany({
            where: {
                taskId,
                isActive: true,
                OR: [
                    { expiresAt: null },
                    { expiresAt: { gt: new Date() } }
                ]
            },
            orderBy: { createdAt: 'desc' }
        });

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
}

// DELETE /api/tasks/[id]/share - Deactivate a share link
export async function DELETE(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
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
        await prisma.shareableReview.updateMany({
            where: {
                taskId: params.id,
                shareToken,
            },
            data: {
                isActive: false
            }
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
}
