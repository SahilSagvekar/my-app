import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { sendRawEmail } from '@/lib/email';

function getTokenFromCookies(req: Request) {
    const cookieHeader = req.headers.get('cookie');
    if (!cookieHeader) return null;
    const match = cookieHeader.match(/authToken=([^;]+)/);
    return match ? match[1] : null;
}

export async function POST(req: NextRequest) {
    try {
        const token = getTokenFromCookies(req);
        if (!token) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });

        const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
        if (!decoded?.userId) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });

        const { leadIds, subject, body } = await req.json();

        if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
            return NextResponse.json({ ok: false, message: 'No leads selected' }, { status: 400 });
        }

        const leads = await prisma.salesLead.findMany({
            where: {
                id: { in: leadIds },
                // Optional: ensure user owns the leads if NOT admin
                ...(decoded.role !== 'admin' ? { userId: decoded.userId } : {})
            }
        });

        if (leads.length === 0) {
            return NextResponse.json({ ok: false, message: 'Leads not found' }, { status: 404 });
        }

        const results = {
            success: 0,
            failed: 0,
            errors: [] as string[],
        };

        // Send emails sequentially or in small batches
        for (const lead of leads) {
            if (!lead.email) {
                results.failed++;
                results.errors.push(`Lead ${lead.name} has no email`);
                continue;
            }

            // Replace variables
            const personalizedBody = body
                .replace(/{name}/g, lead.name || 'there')
                .replace(/{company}/g, lead.company || 'your company');

            const emailHtml = `
                <div style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px;">
                    ${personalizedBody.replace(/\n/g, '<br/>')}
                </div>
                <br/>
                <div style="font-size: 12px; color: #999; border-top: 1px solid #eee; padding-top: 10px;">
                    Sent via E8 Productions Portal
                </div>
            `;

            const res = await sendRawEmail({
                to: lead.email,
                subject,
                html: emailHtml
            });

            if (res.success) {
                results.success++;
                // Log activity or update lead status
                await prisma.salesLead.update({
                    where: { id: lead.id },
                    data: {
                        emailed: true,
                        emailedAt: new Date().toISOString(),
                        notes: (lead.notes || '') + `\n[${new Date().toLocaleDateString()}] Bulk email sent: ${subject}`
                    }
                });
            } else {
                results.failed++;
                results.errors.push(`Failed to send to ${lead.email}: ${res.error}`);
            }
        }

        return NextResponse.json({ ok: true, results });

    } catch (err) {
        console.error('[POST /api/sales-leads/bulk-email]', err);
        return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
    }
}
