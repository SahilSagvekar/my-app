import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser2 } from '@/lib/auth';

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
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
        const job = await (prisma as any).job.findUnique({ where: { id: jobId } });
        if (!job || job.status !== 'OPEN') {
            return NextResponse.json({ error: 'Job is not open for bidding.' }, { status: 400 });
        }

        // Check if user already bid
        const existingBid = await prisma.bid.findFirst({
            where: {
                jobId,
                userId: user.id
            }
        });

        if (existingBid) {
            // Update existing bid
            const updatedBid = await prisma.bid.update({
                where: { id: existingBid.id },
                data: {
                    amount: parseFloat(amount),
                    note,
                    status: 'PENDING' // Reset status if they update
                }
            });
            return NextResponse.json(updatedBid);
        }

        // Create new bid
        const newBid = await prisma.bid.create({
            data: {
                jobId,
                userId: user.id,
                amount: parseFloat(amount),
                note,
                status: 'PENDING'
            }
        });

        return NextResponse.json(newBid, { status: 201 });

    } catch (error: any) {
        console.error('Error submitting bid:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
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

        const bids = await prisma.bid.findMany({
            where: { jobId: params.id },
            include: {
                videographer: {
                    select: { id: true, name: true, email: true, image: true }
                }
            },
            orderBy: {
                amount: sort === 'desc' ? 'desc' : 'asc'
            }
        });

        return NextResponse.json(bids);

    } catch (error: any) {
        console.error('Error fetching bids:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
