import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser2 } from '@/lib/auth';
import { sendNewJobNotificationEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
    try {
        const user = await getCurrentUser2(req);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Only Admin or Manager can create jobs
        if (user.role !== 'admin' && user.role !== 'manager') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await req.json();
        const { title, description, location, shootDate, budget } = body;

        if (!title || !description || !shootDate) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // 1. Create Job
        const job = await (prisma as any).job.create({
            data: {
                title,
                description,
                location,
                shootDate: new Date(shootDate),
                budget: budget ? parseFloat(budget) : null,
                createdById: user.id,
                status: 'OPEN',
            },
        });

        // 2. Fetch Active Videographers
        const videographers = await prisma.user.findMany({
            where: {
                role: 'videographer',
                employeeStatus: 'ACTIVE'
            },
            select: {
                id: true,
                email: true,
                name: true,
            },
        });

        // 3. Create Notifications in DB
        await Promise.all(videographers.map(vg =>
            (prisma as any).notification.create({
                data: {
                    userId: vg.id,
                    type: 'JOB_ALERT',
                    title: 'New Job Posted: ' + title,
                    body: `A new job "${title}" is available for bidding.`,
                    payload: { jobId: job.id, link: `/portal/jobs/${job.id}` },
                }
            })
        ));

        // 4. Send Emails
        const jobLink = `${process.env.BASE_URL || 'http://localhost:3000'}/portal/jobs/${job.id}`;

        sendNewJobNotificationEmail(
            videographers.map(v => ({ email: v.email, name: v.name || 'Videographer' })),
            {
                title: job.title,
                location: job.location || 'TBD',
                date: job.shootDate.toLocaleDateString(),
                link: jobLink
            }
        ).catch(err => console.error('Background email sending failed:', err));

        return NextResponse.json(job, { status: 201 });

    } catch (error: any) {
        console.error('Error creating job:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    try {
        const user = await getCurrentUser2(req);

        if (!user) {
            console.error('DEBUG [API JOBS GET] No valid user found');
            return NextResponse.json({ error: 'Unauthorized - Please log in' }, { status: 401 });
        }

        console.log(`DEBUG [API JOBS GET] User: ${user.email}, Role: ${user.role}, ID: ${user.id}`);

        const { searchParams } = new URL(req.url);
        const status = searchParams.get('status');

        const whereClause: any = {};
        if (status) whereClause.status = status;

        const jobs = await (prisma as any).job.findMany({
            where: whereClause,
            include: {
                _count: {
                    select: { bids: true }
                },
                bids: user.role === 'admin' || user.role === 'manager'
                    ? { include: { videographer: { select: { name: true, email: true, image: true } } } }
                    : (user.role === 'videographer')
                        ? { where: { userId: user.id } }
                        : false
            },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json(jobs);

    } catch (error: any) {
        console.error('Error fetching jobs server-side:', error);
        return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
    }
}
