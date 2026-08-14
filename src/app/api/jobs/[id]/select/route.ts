export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { job, bid, user as userTable, notification } from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { and, eq, ne } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';
import { sendBidAcceptedEmail } from '@/lib/email';

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { db, closeDb } = getDb();
  try {
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
        const foundJob = await db.query.job.findFirst({
            where: eq(job.id, jobId),
            with: { bids: true }
        });

        if (!foundJob) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
        if (foundJob.status !== 'OPEN') return NextResponse.json({ error: 'Job is not open' }, { status: 400 });

        const selectedBid = foundJob.bids.find((b: any) => b.id === bidId);
        if (!selectedBid) return NextResponse.json({ error: 'Bid not found related to this job' }, { status: 404 });

        // 2. Assign Job and Update Bid Statuses — independent statements, no
        // reads between them, so array-form $transaction maps to db.batch.
        await db.batch([
            db.update(job).set({
                status: 'ASSIGNED',
                assignedToId: selectedBid.userId,
                updatedAt: new Date().toISOString(),
            }).where(eq(job.id, jobId)),
            db.update(bid).set({ status: 'ACCEPTED' }).where(eq(bid.id, bidId)),
            db.update(bid).set({ status: 'REJECTED' }).where(and(eq(bid.jobId, jobId), ne(bid.id, bidId))),
        ]);

        // 3. Send Notification to Winner
        const [winner] = await db.select({ id: userTable.id, email: userTable.email, name: userTable.name })
            .from(userTable).where(eq(userTable.id, selectedBid.userId)).limit(1);

        if (winner) {
            const jobLink = `${process.env.BASE_URL || 'http://localhost:3000'}/portal/jobs/${foundJob.id}`;

            // Email
            await sendBidAcceptedEmail(
                { email: winner.email, name: winner.name || 'Videographer' },
                {
                    title: foundJob.title,
                    date: new Date(foundJob.startDate).toLocaleDateString(),
                    amount: parseFloat(selectedBid.amount.toString()),
                    link: jobLink
                }
            );

            // In-App Notification
            await db.insert(notification).values({
                id: createId(),
                userId: winner.id,
                type: 'BID_ACCEPTED',
                title: 'Congratulations! You got the job: ' + foundJob.title,
                body: `Your bid of $${selectedBid.amount} was accepted for ${foundJob.title}.`,
                payload: { jobId: foundJob.id, link: jobLink },
                updatedAt: new Date().toISOString(),
            });
        }

        return NextResponse.json({ success: true, message: 'Videographer selected successfully' });

    } catch (error: any) {
        console.error('Error selecting videographer:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

  } finally {
    await closeDb();
  }
}
