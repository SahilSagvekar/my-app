// src/app/api/cron/auto-invoice/route.ts
// Daily job: for every client with autoInvoiceActive=true whose nextBillingDate
// has arrived, creates a Stripe invoice for their configured recurring amount,
// sends it immediately, records it locally, and advances nextBillingDate by one
// month. Idempotent via local + Stripe metadata.billingCycle.
//
// Supports dryRun=true (query or JSON body) to preview without creating invoices.

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getDbHttp } from '@/lib/db';
import {
  clientPortalAccess as clientPortalAccessTable,
  invoice as invoiceTable,
  stripeCustomer as stripeCustomerTable,
  subscription as subscriptionTable,
} from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { and, eq, gt, inArray, isNotNull, lte, sql } from 'drizzle-orm';
import {
  generateInvoiceNumber,
  getOrCreateStripeCustomer,
  createStripeInvoice,
  sendStripeInvoice,
  stripe,
} from '@/lib/stripe';
import { advanceOneCalendarMonth } from '@/lib/auto-invoice';
import { sendInvoiceCopiesToAdditionalEmails } from '@/lib/email';

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = req.headers.get('x-cron-secret');
  if (cronSecret && process.env.CRON_SECRET && cronSecret === process.env.CRON_SECRET) {
    return true;
  }

  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ') && process.env.CRON_SECRET) {
    if (authHeader.slice(7) === process.env.CRON_SECRET) return true;
  }

  const cookieHeader = req.headers.get('cookie');
  const match = cookieHeader?.match(/authToken=([^;]+)/);
  const token = match ? match[1] : null;
  if (!token) return false;

  try {
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    return decoded.role?.toLowerCase() === 'admin';
  } catch {
    return false;
  }
}

type ResultRow = {
  clientId: string;
  clientName: string;
  status: 'invoiced' | 'would_invoice' | 'skipped' | 'failed';
  reason?: string;
  amountCents?: number;
  billingCycle?: string;
};

async function hasActiveSubscription(db: ReturnType<typeof getDbHttp>, stripeCustomerDbId: string, stripeCustomerId: string): Promise<boolean> {
  const [localSub] = await db
    .select({ id: subscriptionTable.id })
    .from(subscriptionTable)
    .where(and(
      eq(subscriptionTable.stripeCustomerId, stripeCustomerDbId),
      inArray(subscriptionTable.status, ['ACTIVE', 'TRIALING', 'PAST_DUE']),
    ))
    .limit(1);
  if (localSub) return true;

  try {
    const remote = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: 'active',
      limit: 1,
    });
    if (remote.data.length > 0) return true;
    const trialing = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: 'trialing',
      limit: 1,
    });
    return trialing.data.length > 0;
  } catch {
    // If Stripe lookup fails, lean on local only — don't block invoicing forever.
    return false;
  }
}

async function findExistingStripeInvoiceForCycle(stripeCustomerId: string, billingCycle: string) {
  const listed = await stripe.invoices.list({
    customer: stripeCustomerId,
    limit: 30,
  });
  return listed.data.find(
    (inv) =>
      inv.metadata?.billingCycle === billingCycle &&
      inv.status !== 'void' &&
      inv.status !== 'draft'
  ) ?? null;
}

export async function GET(req: NextRequest) {
  // Preview = dry run via GET for the admin confirm dialog
  return runAutoInvoice(req, true);
}

export async function POST(req: NextRequest) {
  let dryRun = req.nextUrl.searchParams.get('dryRun') === 'true';
  try {
    const body = await req.json().catch(() => null);
    if (body?.dryRun === true) dryRun = true;
  } catch {
    // no body
  }
  return runAutoInvoice(req, dryRun);
}

async function runAutoInvoice(req: NextRequest, dryRun: boolean) {
  const db = getDbHttp();
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const results: ResultRow[] = [];

  try {
    const dueClients = await db.query.clientPortalAccess.findMany({
      where: and(
        eq(clientPortalAccessTable.autoInvoiceActive, true),
        lte(clientPortalAccessTable.nextBillingDate, now.toISOString()),
        isNotNull(clientPortalAccessTable.recurringAmount),
        gt(clientPortalAccessTable.recurringAmount, 0),
      ),
      with: { client: true },
    });

    for (const portalAccess of dueClients) {
      const client = portalAccess.client;
      const clientName = client.companyName || client.name || client.id;
      const billingCycle = new Date(portalAccess.nextBillingDate!).toISOString().slice(0, 10);

      try {
        if (!client.email) {
          results.push({ clientId: client.id, clientName, status: 'skipped', reason: 'no client email on file', billingCycle });
          continue;
        }

        if (!portalAccess.nextBillingDate) {
          results.push({ clientId: client.id, clientName, status: 'skipped', reason: 'no next billing date set', billingCycle });
          continue;
        }

        // Local idempotency
        const [existingLocal] = await db
          .select({ id: invoiceTable.id })
          .from(invoiceTable)
          .innerJoin(stripeCustomerTable, eq(invoiceTable.stripeCustomerId, stripeCustomerTable.id))
          .where(and(
            eq(stripeCustomerTable.clientId, client.id),
            sql`${invoiceTable.metadata}->>'billingCycle' = ${billingCycle}`,
          ))
          .limit(1);
        if (existingLocal) {
          results.push({
            clientId: client.id,
            clientName,
            status: 'skipped',
            reason: 'already invoiced for this cycle',
            billingCycle,
            amountCents: portalAccess.recurringAmount!,
          });
          continue;
        }

        const stripeCustomer = await getOrCreateStripeCustomer(
          client.id,
          client.email,
          client.companyName || client.name
        );

        const [dbStripeCustomer] = await db
          .select()
          .from(stripeCustomerTable)
          .where(eq(stripeCustomerTable.stripeCustomerId, stripeCustomer.id))
          .limit(1);
        if (!dbStripeCustomer) {
          results.push({ clientId: client.id, clientName, status: 'failed', reason: 'failed to resolve Stripe customer', billingCycle });
          continue;
        }

        // Skip clients already on a live Stripe subscription (double-bill guard).
        // Logged explicitly (not just recorded in the response body) so a
        // skip is visible in Cloudflare logs even if nobody's reading the
        // cron's JSON output that day.
        if (await hasActiveSubscription(db, dbStripeCustomer.id, stripeCustomer.id)) {
          console.warn(`⏭️ [auto-invoice] Skipped ${clientName} (${client.id}) for cycle ${billingCycle} — already has an active Stripe subscription (double-bill guard)`);
          results.push({
            clientId: client.id,
            clientName,
            status: 'skipped',
            reason: 'has an active Stripe subscription — turn off auto-invoice or cancel the subscription first',
            billingCycle,
            amountCents: portalAccess.recurringAmount!,
          });
          continue;
        }

        // Stripe-side idempotency (covers create-succeeded / local-insert-failed)
        const existingStripe = await findExistingStripeInvoiceForCycle(stripeCustomer.id, billingCycle);
        if (existingStripe) {
          if (!dryRun) {
            const [byStripeId] = await db
              .select({ id: invoiceTable.id })
              .from(invoiceTable)
              .where(eq(invoiceTable.stripeInvoiceId, existingStripe.id))
              .limit(1);

            if (!byStripeId) {
              const dueDays = portalAccess.dueDays ?? 15;
              const dueDate = new Date(now);
              dueDate.setDate(dueDate.getDate() + dueDays);
              const lineItems = existingStripe.lines?.data?.map((line: any) => ({
                description: line.description || 'Line item',
                amount: line.amount,
                quantity: line.quantity || 1,
              })) || [];

              await db.insert(invoiceTable).values({
                id: createId(),
                stripeCustomerId: dbStripeCustomer.id,
                stripeInvoiceId: existingStripe.id,
                invoiceNumber: existingStripe.metadata?.invoiceNumber || existingStripe.number || generateInvoiceNumber(),
                status: existingStripe.status === 'paid' ? 'PAID' : 'SENT',
                amount: existingStripe.total ?? existingStripe.amount_due ?? portalAccess.recurringAmount!,
                currency: 'usd',
                dueDate: dueDate.toISOString(),
                description: portalAccess.recurringDescription || 'Monthly retainer',
                lineItems,
                isRecurring: true,
                stripeHostedInvoiceUrl: existingStripe.hosted_invoice_url,
                stripePdfUrl: existingStripe.invoice_pdf,
                sentAt: now.toISOString(),
                metadata: { invoiceType: 'RECURRING', billingCycle },
                updatedAt: new Date().toISOString(),
              });
            }

            const nextBilling = advanceOneCalendarMonth(portalAccess.nextBillingDate!);
            await db.update(clientPortalAccessTable).set({
              nextBillingDate: nextBilling.toISOString(),
              updatedAt: new Date().toISOString(),
            }).where(eq(clientPortalAccessTable.clientId, client.id));
          }

          results.push({
            clientId: client.id,
            clientName,
            status: dryRun ? 'would_invoice' : 'invoiced',
            reason: 'recovered existing Stripe invoice for this cycle',
            billingCycle,
            amountCents: portalAccess.recurringAmount!,
          });
          continue;
        }

        if (dryRun) {
          results.push({
            clientId: client.id,
            clientName,
            status: 'would_invoice',
            billingCycle,
            amountCents: portalAccess.recurringAmount!,
          });
          continue;
        }

        const invoiceNumber = generateInvoiceNumber();
        const lineItemDescription = portalAccess.recurringDescription || 'Monthly retainer';
        const dueDays = portalAccess.dueDays ?? 15;

        const stripeInvoice = await createStripeInvoice(
          stripeCustomer.id,
          [{ description: lineItemDescription, amount: portalAccess.recurringAmount! }],
          dueDays,
          { invoiceNumber, clientId: client.id, invoiceType: 'RECURRING', billingCycle },
          lineItemDescription
        );

        const sentInvoice = await sendStripeInvoice(stripeInvoice.id);

        const authoritative = await stripe.invoices.retrieve(stripeInvoice.id);
        const finalLineItems = authoritative.lines.data.map((line: any) => ({
          description: line.description || 'Line item',
          amount: line.amount,
          quantity: line.quantity || 1,
        }));
        const finalTotalAmount = authoritative.total ?? authoritative.amount_due ?? portalAccess.recurringAmount!;

        const dueDate = new Date(now);
        dueDate.setDate(dueDate.getDate() + dueDays);

        // Insert local row BEFORE advancing the schedule so a failed insert
        // doesn't leave the client billed in Stripe with a skipped cycle.
        await db.insert(invoiceTable).values({
          id: createId(),
          stripeCustomerId: dbStripeCustomer.id,
          stripeInvoiceId: stripeInvoice.id,
          invoiceNumber,
          status: 'SENT',
          amount: finalTotalAmount,
          currency: 'usd',
          dueDate: dueDate.toISOString(),
          description: lineItemDescription,
          lineItems: finalLineItems,
          isRecurring: true,
          stripeHostedInvoiceUrl: sentInvoice.hosted_invoice_url,
          stripePdfUrl: sentInvoice.invoice_pdf,
          sentAt: now.toISOString(),
          metadata: { invoiceType: 'RECURRING', billingCycle },
          updatedAt: new Date().toISOString(),
        });

        await sendInvoiceCopiesToAdditionalEmails({
          clientId: client.id,
          invoiceNumber,
          amountCents: finalTotalAmount,
          currency: 'usd',
          description: lineItemDescription,
          dueDate: dueDate.toISOString(),
          invoiceUrl: sentInvoice.hosted_invoice_url,
          pdfUrl: sentInvoice.invoice_pdf,
        });

        const nextBilling = advanceOneCalendarMonth(portalAccess.nextBillingDate!);
        await db.update(clientPortalAccessTable).set({
          nextBillingDate: nextBilling.toISOString(),
          updatedAt: new Date().toISOString(),
        }).where(eq(clientPortalAccessTable.clientId, client.id));

        results.push({
          clientId: client.id,
          clientName,
          status: 'invoiced',
          billingCycle,
          amountCents: finalTotalAmount,
        });
      } catch (err: any) {
        console.error(`[auto-invoice] Failed for client ${client.id}:`, err);
        results.push({ clientId: client.id, clientName, status: 'failed', reason: err.message, billingCycle });
      }
    }

    const invoiced = results.filter((r) => r.status === 'invoiced' || r.status === 'would_invoice').length;
    const skipped = results.filter((r) => r.status === 'skipped').length;
    const failed = results.filter((r) => r.status === 'failed').length;

    return NextResponse.json({
      ok: true,
      dryRun,
      message: dryRun
        ? `Preview: ${invoiced} would be invoiced, ${skipped} skipped, ${failed} failed (of ${dueClients.length} due)`
        : `Invoiced ${results.filter((r) => r.status === 'invoiced').length}, skipped ${skipped}, failed ${failed} (of ${dueClients.length} due)`,
      dueCount: dueClients.length,
      results,
    });
  } catch (err: any) {
    console.error('[auto-invoice] Fatal error:', err);
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}