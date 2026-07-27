export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken, requireAdmin } from '@/lib/auth-helpers';

// GET - List every active client with their recurring auto-invoice settings
export async function GET(req: NextRequest) {
  try {
    const currentUser = getUserFromToken(req);
    const authError = requireAdmin(currentUser);
    if (authError) {
      return NextResponse.json({ ok: false, message: authError.error }, { status: authError.status });
    }

    const clients = await prisma.client.findMany({
      where: { status: 'active' },
      select: {
        id: true,
        name: true,
        companyName: true,
        email: true,
        portalAccess: {
          select: {
            id: true,
            status: true,
            autoInvoiceActive: true,
            recurringAmount: true,
            recurringDescription: true,
            dueDays: true,
            billingAnchorDate: true,
            nextBillingDate: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const rows = clients.map((c) => ({
      clientId: c.id,
      name: c.name,
      companyName: c.companyName,
      email: c.email,
      portalStatus: c.portalAccess?.status ?? null,
      autoInvoiceActive: c.portalAccess?.autoInvoiceActive ?? false,
      recurringAmount: c.portalAccess?.recurringAmount ?? null, // cents
      recurringDescription: c.portalAccess?.recurringDescription ?? '',
      dueDays: c.portalAccess?.dueDays ?? 15,
      nextBillingDate: c.portalAccess?.nextBillingDate ?? null,
    }));

    return NextResponse.json({ ok: true, rows });
  } catch (error: any) {
    console.error('Error fetching auto-invoice settings:', error);
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }
}

// PATCH - Bulk upsert recurring auto-invoice settings
// body: { rows: Array<{ clientId, autoInvoiceActive, recurringAmount (dollars), recurringDescription, dueDays, nextBillingDate }> }
export async function PATCH(req: NextRequest) {
  try {
    const currentUser = getUserFromToken(req);
    const authError = requireAdmin(currentUser);
    if (authError) {
      return NextResponse.json({ ok: false, message: authError.error }, { status: authError.status });
    }

    const body = await req.json();
    const rows = Array.isArray(body?.rows) ? body.rows : [];

    if (rows.length === 0) {
      return NextResponse.json({ ok: false, message: 'rows is required' }, { status: 400 });
    }

    const results = [];
    for (const row of rows) {
      const { clientId, autoInvoiceActive, recurringAmount, recurringDescription, dueDays, nextBillingDate } = row;
      if (!clientId) continue;

      const amountCents =
        recurringAmount === null || recurringAmount === undefined || recurringAmount === ''
          ? null
          : Math.round(parseFloat(recurringAmount) * 100);

      const data = {
        autoInvoiceActive: !!autoInvoiceActive,
        recurringAmount: amountCents,
        recurringDescription: recurringDescription || null,
        dueDays: dueDays ? parseInt(dueDays, 10) : 15,
        ...(nextBillingDate ? { nextBillingDate: new Date(nextBillingDate) } : {}),
      };

      const updated = await prisma.clientPortalAccess.upsert({
        where: { clientId },
        update: data,
        create: {
          clientId,
          status: 'ACTIVE',
          ...data,
        },
      });

      results.push({ clientId, id: updated.id });
    }

    return NextResponse.json({ ok: true, updated: results.length });
  } catch (error: any) {
    console.error('Error updating auto-invoice settings:', error);
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }
}