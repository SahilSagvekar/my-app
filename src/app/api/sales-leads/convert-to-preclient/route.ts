export const dynamic = 'force-dynamic';
// POST /api/sales-leads/convert-to-preclient
// Converts one or more of the current sales rep's leads into PreClient records
// (the admin pipeline: PreClient -> Quote -> QUOTE_ACCEPTED -> provision()).
// Converted leads are removed from the sales rep's sheet.

import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { salesLead, preClient as preClientTable, affiliateCommission } from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { and, eq, inArray } from 'drizzle-orm';
import jwt from 'jsonwebtoken';

function getTokenFromCookies(req: Request) {
  const cookieHeader = req.headers.get('cookie');
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/authToken=([^;]+)/);
  return match ? match[1] : null;
}

export async function POST(req: NextRequest) {
  const db = getDbHttp();
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
    const leads = await db.select().from(salesLead)
      .where(decoded.role === 'admin'
        ? inArray(salesLead.id, leadIds)
        : and(inArray(salesLead.id, leadIds), eq(salesLead.userId, decoded.userId)));

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

      const [existing] = await db.select().from(preClientTable).where(eq(preClientTable.email, lead.email)).limit(1);
      if (existing) {
        skipped.push({ name: lead.name, reason: 'Already a pre-client' });
        continue;
      }

      await db.insert(preClientTable).values({
        id: createId(),
        name: lead.name,
        email: lead.email,
        phone: lead.phone || null,
        companyName: lead.company || null,
        createdById: decoded.userId,
        updatedAt: new Date().toISOString(),
      });

      convertedIds.push(lead.id);
      converted++;
    }

    if (convertedIds.length > 0) {
      await db.delete(affiliateCommission).where(inArray(affiliateCommission.leadId, convertedIds));
      await db.delete(salesLead).where(inArray(salesLead.id, convertedIds));
    }

    return NextResponse.json({ ok: true, converted, skipped, convertedIds });
  } catch (err) {
    console.error('[POST /api/sales-leads/convert-to-preclient]', err);
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
  }
}
