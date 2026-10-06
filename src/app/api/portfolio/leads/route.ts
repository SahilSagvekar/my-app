export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { portfolioLead } from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { desc, inArray } from 'drizzle-orm';
import { getUserFromToken } from '@/lib/auth-helpers';
import { sendToChannel } from '@/lib/slack';

function requireLeadsAccess(req: NextRequest) {
    const user = getUserFromToken(req);
    if (!user) return { error: 'Unauthorized', status: 401 };
    if (user.role !== 'admin' && user.role !== 'manager') {
        return { error: 'Access denied', status: 403 };
    }
    return null;
}

// POST /api/portfolio/leads — save a portfolio gate form submission
export async function POST(req: NextRequest) {
  const db = getDbHttp();
    try {
        const body = await req.json();

        const { firstName, lastName, phone, email, serviceNeeded } = body ?? {};

        // Validate required fields (and that they're strings — .trim() on anything else
        // used to throw and surface as a generic 500)
        if (
            ![firstName, lastName, phone, email, serviceNeeded].every(
                (v) => typeof v === 'string' && v.trim().length > 0 && v.length <= 200
            )
        ) {
            return NextResponse.json(
                { ok: false, message: 'All fields are required' },
                { status: 400 }
            );
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return NextResponse.json(
                { ok: false, message: 'Invalid email address' },
                { status: 400 }
            );
        }

        // Behind Cloudflare the real client IP is cf-connecting-ip; x-forwarded-for may be a
        // comma-separated chain.
        const ip =
            req.headers.get('cf-connecting-ip') ||
            req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
            'unknown';

        const [lead] = await db.insert(portfolioLead).values({
            id: createId(),
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            phone: phone.trim(),
            email: email.trim().toLowerCase(),
            // Keep the service clean — it used to have " | IP: …" appended, which broke the
            // admin's service filter and per-service counts. The IP has its own column.
            serviceNeeded: serviceNeeded.trim(),
            ipAddress: ip,
        }).returning();

        sendToChannel('sales', {
            type: 'portfolio_lead',
            message:
                `📋 *New Portfolio Lead*\n` +
                `*Name:* ${firstName.trim()} ${lastName.trim()}\n` +
                `*Email:* ${email.trim().toLowerCase()}\n` +
                `*Phone:* ${phone.trim()}\n` +
                `*Service Needed:* ${serviceNeeded}`,
        }).catch((err) => console.error('[POST /api/portfolio/leads] Slack notify failed', err));

        return NextResponse.json({ ok: true, lead });
    } catch (err) {
        console.error('[POST /api/portfolio/leads]', err);
        return NextResponse.json(
            { ok: false, message: 'Server error' },
            { status: 500 }
        );
    }
}

// GET /api/portfolio/leads — admin/manager: fetch all leads
export async function GET(req: NextRequest) {
  const db = getDbHttp();
    try {
        const authError = requireLeadsAccess(req);
        if (authError) {
            return NextResponse.json(
                { ok: false, message: authError.error },
                { status: authError.status }
            );
        }

        const rows = await db.select().from(portfolioLead).orderBy(desc(portfolioLead.createdAt));

        // Older rows have the IP baked into serviceNeeded ("Service | IP: 1.2.3.4"). Split it
        // out on read so filters/stats group correctly without a data migration.
        const leads = rows.map((l) => {
            const m = l.serviceNeeded.match(/^(.*?)\s*\|\s*IP:\s*(.*)$/);
            return m ? { ...l, serviceNeeded: m[1], ipAddress: l.ipAddress ?? m[2] } : l;
        });

        return NextResponse.json({ ok: true, leads });
    } catch (err) {
        console.error('[GET /api/portfolio/leads]', err);
        return NextResponse.json(
            { ok: false, message: 'Server error' },
            { status: 500 }
        );
    }
}

// DELETE /api/portfolio/leads — admin/manager: delete one or more leads
// body: { ids: string[] }
export async function DELETE(req: NextRequest) {
  const db = getDbHttp();
    try {
        const authError = requireLeadsAccess(req);
        if (authError) {
            return NextResponse.json(
                { ok: false, message: authError.error },
                { status: authError.status }
            );
        }

        const body = await req.json();
        const ids = body?.ids;

        if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => typeof id === 'string')) {
            return NextResponse.json(
                { ok: false, message: 'ids must be a non-empty array of strings' },
                { status: 400 }
            );
        }

        const deleted = await db.delete(portfolioLead).where(inArray(portfolioLead.id, ids)).returning({ id: portfolioLead.id });

        return NextResponse.json({ ok: true, deleted: deleted.length });
    } catch (err) {
        console.error('[DELETE /api/portfolio/leads]', err);
        return NextResponse.json(
            { ok: false, message: 'Server error' },
            { status: 500 }
        );
    }
}
