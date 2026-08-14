export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { job, bid } from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { and, eq, asc, desc } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { db, closeDb } = getDb();
  try {
    const params = await props.params;
    try {
        const user = await getCurrentUser2(req);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (user.role !== 'videographer') {
            return NextResponse.json({ error: 'Only videographers can bid.' }, { status: 403 });
        }

        const { id: jobId } = params;
        const body = await req.json();
        const { amount, note } = body;

        if (!amount || amount <= 0) {
            return NextResponse.json({ error: 'Invalid bid amount' }, { status: 400 });
        }

        // Check if job is open
        const [foundJob] = await db.select().from(job).where(eq(job.id, jobId)).limit(1);
        if (!foundJob || foundJob.status !== 'OPEN') {
            return NextResponse.json({ error: 'Job is not open for bidding.' }, { status: 400 });
        }

        // Check if user already bid
        const [existingBid] = await db.select().from(bid).where(and(eq(bid.jobId, jobId), eq(bid.userId, user.id))).limit(1);

        if (existingBid) {
            // Update existing bid
            const [updatedBid] = await db.update(bid).set({
                amount: String(parseFloat(amount)),
                note,
                status: 'PENDING' // Reset status if they update
            }).where(eq(bid.id, existingBid.id)).returning();
            return NextResponse.json(updatedBid);
        }

        // Create new bid
        const [newBid] = await db.insert(bid).values({
            id: createId(),
            jobId,
            userId: user.id,
            amount: String(parseFloat(amount)),
            note,
            status: 'PENDING'
        }).returning();

        return NextResponse.json(newBid, { status: 201 });

    } catch (error: any) {
        console.error('Error submitting bid:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

  } finally {
    await closeDb();
  }
}

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { db, closeDb } = getDb();
  try {
    const params = await props.params;
    try {
        const user = await getCurrentUser2(req);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Only Admin/Manager can view all bids
        if (user.role !== 'admin' && user.role !== 'manager') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const sort = searchParams.get('sort') || 'asc'; // asc = lowest first, desc = highest first

        const rawBids = await db.query.bid.findMany({
            where: eq(bid.jobId, params.id),
            with: {
                user: {
                    columns: { id: true, name: true, email: true, image: true }
                }
            },
            orderBy: sort === 'desc' ? desc(bid.amount) : asc(bid.amount),
        });
        const bids = rawBids.map(({ user: videographer, ...b }: any) => ({ ...b, videographer }));

        return NextResponse.json(bids);

    } catch (error: any) {
        console.error('Error fetching bids:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

  } finally {
    await closeDb();
  }
}
