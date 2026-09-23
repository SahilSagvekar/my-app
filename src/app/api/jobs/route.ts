export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { job, bid, user as userTable, notification } from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { and, eq, or, arrayContains, desc, inArray, count as countFn } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';
import { sendNewJobNotificationEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
  const db = getDbHttp();
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
        const {
            title, description, location, startDate, endDate,
            equipment, camera, quality, frameRate, lighting,
            exclusions, referenceLinks, budget, clientId
        } = body;

        if (!title || !description || !startDate) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // 1. Create Job
        const [createdJob] = await db.insert(job).values({
            id: createId(),
            title,
            description,
            location,
            startDate: new Date(startDate).toISOString(),
            endDate: endDate ? new Date(endDate).toISOString() : null,
            equipment,
            camera,
            quality,
            frameRate,
            lighting,
            exclusions,
            referenceLinks: Array.isArray(referenceLinks) ? referenceLinks : [],
            budget: budget ? String(parseFloat(budget)) : null,
            createdById: user.id,
            clientId: clientId || null,
            status: 'OPEN',
            updatedAt: new Date().toISOString(),
        }).returning();

        // 2. Fetch Active Videographers — primary role OR videographer as a
        // secondary role, so multi-role staff (e.g. an admin who also
        // shoots) still get notified about new job posts.
        const videographers = await db.select({
            id: userTable.id,
            email: userTable.email,
            name: userTable.name,
        }).from(userTable).where(and(
            or(eq(userTable.role, 'videographer'), arrayContains(userTable.roles, ['videographer'])),
            eq(userTable.employeeStatus, 'ACTIVE')
        ));

        // 3. Create Notifications in DB
        await Promise.all(videographers.map(vg =>
            db.insert(notification).values({
                id: createId(),
                userId: vg.id,
                type: 'JOB_ALERT',
                title: 'New Job Posted: ' + title,
                body: `A new job "${title}" is available for bidding.`,
                payload: { jobId: createdJob.id, link: `/portal/jobs/${createdJob.id}` },
                updatedAt: new Date().toISOString(),
            })
        ));

        // 4. Send Emails
        const jobLink = `${process.env.BASE_URL || 'http://localhost:3000'}/portal/jobs/${createdJob.id}`;

        sendNewJobNotificationEmail(
            videographers.map(v => ({ email: v.email, name: v.name || 'Videographer' })),
            {
                title: createdJob.title,
                location: createdJob.location || 'TBD',
                date: new Date(createdJob.startDate).toLocaleDateString(),
                link: jobLink
            }
        ).catch(err => console.error('Background email sending failed:', err));

        return NextResponse.json(createdJob, { status: 201 });

    } catch (error: any) {
        console.error('Error creating job:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
  const db = getDbHttp();
    try {
        const user = await getCurrentUser2(req);

        if (!user) {
            console.error('DEBUG [API JOBS GET] No valid user found');
            return NextResponse.json({ error: 'Unauthorized - Please log in' }, { status: 401 });
        }

        console.log(`DEBUG [API JOBS GET] User: ${user.email}, Role: ${user.role}, ID: ${user.id}`);

        const { searchParams } = new URL(req.url);
        const status = searchParams.get('status');

        const rawJobs = await db.query.job.findMany({
            where: status ? eq(job.status, status as any) : undefined,
            with: {
                client: {
                    columns: { id: true, name: true, companyName: true }
                },
                bids: user.role === 'admin' || user.role === 'manager'
                    ? { with: { user: { columns: { name: true, email: true, image: true } } } }
                    : (user.role === 'videographer')
                        ? { where: (b, { eq }) => eq(b.userId, user.id) }
                        : undefined,
            },
            orderBy: desc(job.createdAt),
        });

        // _count.bids must reflect the TOTAL bid count regardless of the
        // role-based filter applied to `bids` above (matches Prisma's
        // `_count` semantics, which ignores the sibling `include` filter) —
        // fetched separately rather than derived from the filtered array.
        const jobIds = rawJobs.map((j: any) => j.id);
        const bidCounts = jobIds.length > 0
            ? await db.select({ jobId: bid.jobId, value: countFn() }).from(bid).where(inArray(bid.jobId, jobIds)).groupBy(bid.jobId)
            : [];
        const bidCountMap = new Map(bidCounts.map(c => [c.jobId, c.value]));

        // Rename bid.user -> bid.videographer (Prisma relation name).
        const jobs = rawJobs.map((j: any) => {
            const bids = j.bids === undefined ? undefined : j.bids.map(({ user: videographer, ...b }: any) =>
                videographer !== undefined ? { ...b, videographer } : b
            );
            return {
                ...j,
                bids,
                _count: { bids: bidCountMap.get(j.id) || 0 },
            };
        });

        return NextResponse.json(jobs);

    } catch (error: any) {
        console.error('Error fetching jobs server-side:', error);
        return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
    }
}
