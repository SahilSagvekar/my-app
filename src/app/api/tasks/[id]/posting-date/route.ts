export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

function getTokenFromCookies(req: Request) {
    const cookieHeader = req.headers.get('cookie');
    if (!cookieHeader) return null;
    const m = cookieHeader.match(/authToken=([^;]+)/);
    return m ? m[1] : null;
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const token = getTokenFromCookies(req);
        if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
        const { role } = decoded;

        if (!['scheduler', 'manager', 'admin'].includes((role || '').toLowerCase())) {
            return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
        }

        const { id } = await params;
        const { postedAt } = await req.json();

        if (!postedAt) return NextResponse.json({ message: 'postedAt is required' }, { status: 400 });

        const newDate = new Date(postedAt);
        if (isNaN(newDate.getTime())) return NextResponse.json({ message: 'Invalid date' }, { status: 400 });

        // 1. Update all PostedContent rows linked to this task
        const updatedCount = await prisma.postedContent.updateMany({
            where: { taskId: id },
            data: { postedAt: newDate },
        });

        // 2. Update postedAt on every link in Task.socialMediaLinks JSON array
        const task = await prisma.task.findUnique({
            where: { id },
            select: { socialMediaLinks: true },
        });

        if (task) {
            const links = Array.isArray(task.socialMediaLinks) ? task.socialMediaLinks as any[] : [];
            const updatedLinks = links.map((l: any) => ({ ...l, postedAt: newDate.toISOString() }));
            await prisma.task.update({
                where: { id },
                data: { socialMediaLinks: updatedLinks },
            });
        }

        return NextResponse.json({
            success: true,
            postedAt: newDate.toISOString(),
            updatedContentRows: updatedCount.count,
        });
    } catch (err: any) {
        console.error('PATCH /api/tasks/[id]/posting-date error:', err);
        return NextResponse.json({ message: 'Server error', error: err.message }, { status: 500 });
    }
}
