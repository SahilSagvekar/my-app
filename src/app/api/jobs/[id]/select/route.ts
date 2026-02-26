export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser2 } from '@/lib/auth';
import { sendBidAcceptedEmail } from '@/lib/email';

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    try {
        const user = await getCurrentUser2(req);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (user.role !== 'admin' && user.role !== 'manager') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id: jobId } = params;
        const body = await req.json();
        const { bidId } = body;

        if (!bidId) {
            return NextResponse.json({ error: 'Missing bid ID' }, { status: 400 });
        }

        // 1. Validate Job and Bid
        const job = await (prisma as any).job.findUnique({
            where: { id: jobId },
            include: { bids: true }
        });

        if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
        if (job.status !== 'OPEN') return NextResponse.json({ error: 'Job is not open' }, { status: 400 });

        const selectedBid = job.bids.find((b: any) => b.id === bidId);
        if (!selectedBid) return NextResponse.json({ error: 'Bid not found related to this job' }, { status: 404 });

        // 2. Assign Job and Update Bid Statuses
        const updateJob = (prisma as any).job.update({
            where: { id: jobId },
            data: {
                status: 'ASSIGNED',
                assignedToId: selectedBid.userId
            }
        });

        const updateSelectedBid = (prisma as any).bid.update({
            where: { id: bidId },
            data: { status: 'ACCEPTED' }
        });

        const rejectOthers = (prisma as any).bid.updateMany({
            where: {
                jobId,
                NOT: { id: bidId }
            },
            data: { status: 'REJECTED' }
        });

        await prisma.$transaction([updateJob, updateSelectedBid, rejectOthers]);

        // 3. Send Notification to Winner
        const winner = await prisma.user.findUnique({
            where: { id: selectedBid.userId },
            select: { id: true, email: true, name: true }
        });

        if (winner) {
            const jobLink = `${process.env.BASE_URL || 'http://localhost:3000'}/portal/jobs/${job.id}`;

            // Email
            await sendBidAcceptedEmail(
                { email: winner.email, name: winner.name || 'Videographer' },
                {
                    title: job.title,
                    date: new Date(job.startDate).toLocaleDateString(),
                    amount: parseFloat(selectedBid.amount.toString()),
                    link: jobLink
                }
            );

            // In-App Notification
            await prisma.notification.create({
                data: {
                    userId: winner.id,
                    type: 'BID_ACCEPTED',
                    title: 'Congratulations! You got the job: ' + job.title,
                    body: `Your bid of $${selectedBid.amount} was accepted for ${job.title}.`,
                    payload: { jobId: job.id, link: jobLink }
                }
            });
        }

        return NextResponse.json({ success: true, message: 'Videographer selected successfully' });

    } catch (error: any) {
        console.error('Error selecting videographer:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
