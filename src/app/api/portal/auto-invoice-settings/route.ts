export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import {
  client as clientTable,
  clientPortalAccess as clientPortalAccessTable,
  stripeCustomer as stripeCustomerTable,
  subscription as subscriptionTable,
} from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { getUserFromToken, requireAdmin } from '@/lib/auth-helpers';
import { fromDateInputValue } from '@/lib/auto-invoice';

// GET - List every active client with their recurring auto-invoice settings
export async function GET(req: NextRequest) {
  const db = getDbHttp();
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
        stripeCustomers: {
          columns: { id: true },
          with: {
            subscriptions: {
              columns: { id: true, status: true },
            },
          },
        },
      },
      orderBy: asc(clientTable.name),
    });

    const rows = clients.map((c) => {
      const portalAccess = c.clientPortalAccesses[0];
      const subs = (c.stripeCustomers || []).flatMap((sc: any) => sc.subscriptions || []);
      const hasActiveSubscription = subs.some((s: any) =>
        ['ACTIVE', 'TRIALING', 'PAST_DUE'].includes(s.status)
      );

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
        hasActiveSubscription,
        warning: hasActiveSubscription
          ? 'This client already has an active Stripe subscription. Turning on auto-invoice can double-bill them.'
          : null,
      };
    });

    return NextResponse.json({ ok: true, rows });
  } catch (error: any) {
    console.error('Error fetching auto-invoice settings:', error);
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }
}

// PATCH - Bulk upsert recurring auto-invoice settings
// body: { rows: Array<{ clientId, autoInvoiceActive, recurringAmount (dollars), recurringDescription, dueDays, nextBillingDate, clearNextBillingDate? }> }
export async function PATCH(req: NextRequest) {
  const db = getDbHttp();
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
    const errors: Array<{ clientId: string; message: string }> = [];

    for (const row of rows) {
      const {
        clientId,
        autoInvoiceActive,
        recurringAmount,
        recurringDescription,
        dueDays,
        nextBillingDate,
        clearNextBillingDate,
      } = row;
      if (!clientId) continue;

      const amountCents =
        recurringAmount === null || recurringAmount === undefined || recurringAmount === ''
          ? null
          : Math.round(parseFloat(String(recurringAmount)) * 100);

      if (amountCents !== null && (Number.isNaN(amountCents) || amountCents < 0)) {
        errors.push({ clientId, message: 'Monthly amount must be a valid number' });
        continue;
      }

      let parsedDueDays = 15;
      if (dueDays !== null && dueDays !== undefined && dueDays !== '') {
        parsedDueDays = parseInt(String(dueDays), 10);
        if (Number.isNaN(parsedDueDays) || parsedDueDays < 0 || parsedDueDays > 90) {
          errors.push({ clientId, message: 'Days until due must be between 0 and 90' });
          continue;
        }
      }

      const isActive = !!autoInvoiceActive;
      if (isActive) {
        if (!amountCents || amountCents <= 0) {
          errors.push({ clientId, message: 'Turned-on clients need a monthly amount greater than $0' });
          continue;
        }
        const hasIncomingDate = !!(nextBillingDate && String(nextBillingDate).trim());
        if (!hasIncomingDate) {
          const [existingAccess] = await db
            .select({ nextBillingDate: clientPortalAccessTable.nextBillingDate })
            .from(clientPortalAccessTable)
            .where(eq(clientPortalAccessTable.clientId, clientId))
            .limit(1);
          if (!existingAccess?.nextBillingDate || clearNextBillingDate) {
            errors.push({ clientId, message: 'Turned-on clients need a next billing date' });
            continue;
          }
        }
      }

      // Double-bill soft check — still allow save but surface warning in response
      let doubleBillWarning: string | null = null;
      if (isActive) {
        const [sc] = await db
          .select({ id: stripeCustomerTable.id })
          .from(stripeCustomerTable)
          .where(eq(stripeCustomerTable.clientId, clientId))
          .limit(1);
        if (sc) {
          const [sub] = await db
            .select({ id: subscriptionTable.id })
            .from(subscriptionTable)
            .where(and(
              eq(subscriptionTable.stripeCustomerId, sc.id),
              inArray(subscriptionTable.status, ['ACTIVE', 'TRIALING', 'PAST_DUE']),
            ))
            .limit(1);
          if (sub) {
            doubleBillWarning =
              'Client has an active Stripe subscription — auto-invoice will be skipped until that subscription ends.';
          }
        }
      }

      const data: Record<string, unknown> = {
        autoInvoiceActive: isActive,
        recurringAmount: amountCents,
        recurringDescription: recurringDescription || null,
        dueDays: parsedDueDays,
        updatedAt: new Date().toISOString(),
      };

      if (clearNextBillingDate) {
        data.nextBillingDate = null;
      } else if (nextBillingDate) {
        const dateStr = String(nextBillingDate);
        data.nextBillingDate =
          fromDateInputValue(dateStr.slice(0, 10)) || new Date(dateStr).toISOString();
      }

      // Never force portal status to ACTIVE on create — preserve onboarding states.
      const [existing] = await db
        .select({ id: clientPortalAccessTable.id, status: clientPortalAccessTable.status })
        .from(clientPortalAccessTable)
        .where(eq(clientPortalAccessTable.clientId, clientId))
        .limit(1);

      let updated;
      if (existing) {
        [updated] = await db
          .update(clientPortalAccessTable)
          .set(data)
          .where(eq(clientPortalAccessTable.clientId, clientId))
          .returning();
      } else {
        [updated] = await db
          .insert(clientPortalAccessTable)
          .values({
            id: createId(),
            clientId,
            status: 'ONBOARDING',
            ...data,
          })
          .returning();
      }

      results.push({ clientId, id: updated.id, warning: doubleBillWarning });
    }

    if (errors.length > 0 && results.length === 0) {
      return NextResponse.json({ ok: false, message: 'Validation failed', errors }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      updated: results.length,
      results,
      errors: errors.length ? errors : undefined,
    });
  } catch (error: any) {
    console.error('Error updating auto-invoice settings:', error);
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }
}
