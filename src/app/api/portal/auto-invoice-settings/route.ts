export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { client as clientTable, clientPortalAccess as clientPortalAccessTable } from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { asc, eq } from 'drizzle-orm';
import { getUserFromToken, requireAdmin } from '@/lib/auth-helpers';

// GET - List every active client with their recurring auto-invoice settings
export async function GET(req: NextRequest) {
  try {
    const currentUser = getUserFromToken(req);
    const authError = requireAdmin(currentUser);
    if (authError) {
      return NextResponse.json({ ok: false, message: authError.error }, { status: authError.status });
    }

    const clients = await db.query.client.findMany({
      where: eq(clientTable.status, 'active'),
      columns: { id: true, name: true, companyName: true, email: true },
      with: {
        clientPortalAccesses: {
          columns: {
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
      orderBy: asc(clientTable.name),
    });

    const rows = clients.map((c) => {
      // clientPortalAccess has a unique clientId FK (1:1), but drizzle-kit
      // introspection mislabels it many() — take the first (only) entry.
      const portalAccess = c.clientPortalAccesses[0];
      return {
        clientId: c.id,
        name: c.name,
        companyName: c.companyName,
        email: c.email,
        portalStatus: portalAccess?.status ?? null,
        autoInvoiceActive: portalAccess?.autoInvoiceActive ?? false,
        recurringAmount: portalAccess?.recurringAmount ?? null, // cents
        recurringDescription: portalAccess?.recurringDescription ?? '',
        dueDays: portalAccess?.dueDays ?? 15,
        nextBillingDate: portalAccess?.nextBillingDate ?? null,
      };
    });

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
        ...(nextBillingDate ? { nextBillingDate: new Date(nextBillingDate).toISOString() } : {}),
        updatedAt: new Date().toISOString(),
      };

      const [updated] = await db.insert(clientPortalAccessTable).values({
        id: createId(),
        clientId,
        status: 'ACTIVE',
        ...data,
      }).onConflictDoUpdate({
        target: clientPortalAccessTable.clientId,
        set: data,
      }).returning();

      results.push({ clientId, id: updated.id });
    }

    return NextResponse.json({ ok: true, updated: results.length });
  } catch (error: any) {
    console.error('Error updating auto-invoice settings:', error);
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }
}