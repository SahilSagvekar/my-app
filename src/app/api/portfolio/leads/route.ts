export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/portfolio/leads — save a portfolio gate form submission
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        const { firstName, lastName, phone, email, serviceNeeded } = body;

        // Validate required fields
        if (!firstName || !lastName || !phone || !email || !serviceNeeded) {
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

        const ip = req.headers.get('x-forwarded-for') || (req as any).ip || 'unknown';

        const lead = await prisma.portfolioLead.create({
            data: {
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                phone: phone.trim(),
                email: email.trim().toLowerCase(),
                serviceNeeded: `${serviceNeeded} | IP: ${ip}`,
            },
        });

        return NextResponse.json({ ok: true, lead });
    } catch (err) {
        console.error('[POST /api/portfolio/leads]', err);
        return NextResponse.json(
            { ok: false, message: 'Server error' },
            { status: 500 }
        );
    }
}

// GET /api/portfolio/leads — admin: fetch all leads
export async function GET(req: NextRequest) {
    try {
        const leads = await prisma.portfolioLead.findMany({
            orderBy: { createdAt: 'desc' },
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
