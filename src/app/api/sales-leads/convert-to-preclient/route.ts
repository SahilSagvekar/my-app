export const dynamic = 'force-dynamic';
// POST /api/sales-leads/convert-to-preclient
// Converts one or more of the current sales rep's leads into PreClient records
// (the admin pipeline: PreClient -> Quote -> QUOTE_ACCEPTED -> provision()).
// Converted leads are removed from the sales rep's sheet.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

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
    if (!decoded?.userId || !['sales', 'admin', 'sales_manager'].includes(decoded.role)) {
      return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });
    }

    const { leadIds } = await req.json();
    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json({ ok: false, message: 'leadIds array is required' }, { status: 400 });
    }

    // Ownership: reps only convert their own leads; admin can convert any
    const leads = await prisma.salesLead.findMany({
      where: decoded.role === 'admin' ? { id: { in: leadIds } } : { id: { in: leadIds }, userId: decoded.userId },
    });

    let converted = 0;
    const skipped: { name: string; reason: string }[] = [];
    const convertedIds: string[] = [];

    const foundIds = new Set(leads.map(l => l.id));
    for (const id of leadIds) {
      if (!foundIds.has(id)) skipped.push({ name: id, reason: 'Not found or not yours' });
    }

    for (const lead of leads) {
      if (!lead.name || !lead.email) {
        skipped.push({ name: lead.name || lead.email || lead.id, reason: 'Missing name or email' });
        continue;
      }

      const existing = await prisma.preClient.findFirst({ where: { email: lead.email } });
      if (existing) {
        skipped.push({ name: lead.name, reason: 'Already a pre-client' });
        continue;
      }

      await prisma.preClient.create({
        data: {
          name: lead.name,
          email: lead.email,
          phone: lead.phone || null,
          companyName: lead.company || null,
          createdById: decoded.userId,
        },
      });

      convertedIds.push(lead.id);
      converted++;
    }

    if (convertedIds.length > 0) {
      await prisma.affiliateCommission.deleteMany({ where: { leadId: { in: convertedIds } } });
      await prisma.salesLead.deleteMany({ where: { id: { in: convertedIds } } });
    }

    return NextResponse.json({ ok: true, converted, skipped, convertedIds });
  } catch (err) {
    console.error('[POST /api/sales-leads/convert-to-preclient]', err);
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
  }
}
