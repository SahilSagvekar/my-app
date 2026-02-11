import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser2 } from '@/lib/auth';

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    try {
        const user = await getCurrentUser2(req);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const job = await (prisma as any).job.findUnique({
            where: { id: params.id },
            include: {
                _count: {
                    select: { bids: true }
                },
                // Include my bid if I am a videographer
                bids: user.role === 'videographer' ? {
                    where: { userId: user.id }
                } : false
            }
        });

        if (!job) {
            return NextResponse.json({ error: 'Job not found' }, { status: 404 });
        }

        return NextResponse.json(job);

    } catch (error: any) {
        console.error('Error fetching job:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    try {
        const user = await getCurrentUser2(req);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (user.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        await (prisma as any).job.delete({
            where: { id: params.id }
        });

        return NextResponse.json({ success: true, message: 'Job deleted' });

    } catch (error: any) {
        console.error('Error deleting job:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
