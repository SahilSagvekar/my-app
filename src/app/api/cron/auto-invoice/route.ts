// src/app/api/cron/auto-invoice/route.ts
// Daily job (fired by cron-master.ts at 9 AM): for every client with
// autoInvoiceActive=true whose nextBillingDate has arrived, creates a Stripe
// invoice for their configured recurring amount, sends it immediately,
// records it locally, and advances nextBillingDate by one month. Idempotent —
// skips a client if an invoice for this exact billing cycle already exists
// (metadata.billingCycle), so a retried/duplicate cron run never double-bills.

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import {
  generateInvoiceNumber,
  getOrCreateStripeCustomer,
  createStripeInvoice,
  sendStripeInvoice,
  stripe,
} from '@/lib/stripe';

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = req.headers.get('x-cron-secret');
  if (cronSecret && process.env.CRON_SECRET && cronSecret === process.env.CRON_SECRET) {
    return true;
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

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const results: Array<{ clientId: string; status: 'invoiced' | 'skipped' | 'failed'; reason?: string }> = [];

  try {
    const dueClients = await prisma.clientPortalAccess.findMany({
      where: {
        autoInvoiceActive: true,
        nextBillingDate: { lte: now },
        recurringAmount: { not: null, gt: 0 },
      },
      include: { Client: true },
    });

    for (const portalAccess of dueClients) {
      const client = portalAccess.Client;
      const billingCycle = portalAccess.nextBillingDate!.toISOString().slice(0, 10); // YYYY-MM-DD

      try {
        if (!client.email) {
          results.push({ clientId: client.id, status: 'skipped', reason: 'no client email on file' });
          continue;
        }

        // Idempotency guard: has this exact billing cycle already been invoiced?
        const existing = await prisma.invoice.findFirst({
          where: {
            metadata: { path: ['billingCycle'], equals: billingCycle },
            stripeCustomer: { clientId: client.id },
          },
        });
        if (existing) {
          results.push({ clientId: client.id, status: 'skipped', reason: 'already invoiced for this cycle' });
          continue;
        }

        const stripeCustomer = await getOrCreateStripeCustomer(
          client.id,
          client.email,
          client.companyName || client.name
        );

        const dbStripeCustomer = await prisma.stripeCustomer.findUnique({
          where: { stripeCustomerId: stripeCustomer.id },
        });
        if (!dbStripeCustomer) {
          results.push({ clientId: client.id, status: 'failed', reason: 'failed to resolve Stripe customer' });
          continue;
        }

        const invoiceNumber = generateInvoiceNumber();
        const lineItemDescription = portalAccess.recurringDescription || 'Monthly retainer';
        const dueDays = portalAccess.dueDays || 15;

        const stripeInvoice = await createStripeInvoice(
          stripeCustomer.id,
          [{ description: lineItemDescription, amount: portalAccess.recurringAmount! }],
          dueDays,
          { invoiceNumber, clientId: client.id, invoiceType: 'RECURRING', billingCycle },
          lineItemDescription
        );

        const sentInvoice = await sendStripeInvoice(stripeInvoice.id);

        // Re-fetch so local record matches Stripe's authoritative totals
        // (e.g. any pending Tech Fee item Stripe swept in).
        const authoritative = await stripe.invoices.retrieve(stripeInvoice.id);
        const finalLineItems = authoritative.lines.data.map((line: any) => ({
          description: line.description || 'Line item',
          amount: line.amount,
          quantity: line.quantity || 1,
        }));
        const finalTotalAmount = authoritative.total ?? authoritative.amount_due ?? portalAccess.recurringAmount!;

        const dueDate = new Date(now);
        dueDate.setDate(dueDate.getDate() + dueDays);

        await prisma.invoice.create({
          data: {
            stripeCustomerId: dbStripeCustomer.id,
            stripeInvoiceId: stripeInvoice.id,
            invoiceNumber,
            status: 'SENT',
            amount: finalTotalAmount,
            currency: 'usd',
            dueDate,
            description: lineItemDescription,
            lineItems: finalLineItems,
            isRecurring: true,
            stripeHostedInvoiceUrl: sentInvoice.hosted_invoice_url,
            stripePdfUrl: sentInvoice.invoice_pdf,
            sentAt: now,
            metadata: { invoiceType: 'RECURRING', billingCycle },
          },
        });

        // Advance nextBillingDate by exactly one month from the cycle date
        // just billed — not from "now" — so the schedule doesn't drift if the
        // cron runs a bit late.
        const nextBilling = new Date(portalAccess.nextBillingDate!);
        nextBilling.setMonth(nextBilling.getMonth() + 1);

        await prisma.clientPortalAccess.update({
          where: { clientId: client.id },
          data: { nextBillingDate: nextBilling },
        });

        results.push({ clientId: client.id, status: 'invoiced' });
      } catch (err: any) {
        console.error(`[generate-recurring-invoices] Failed for client ${client.id}:`, err);
        results.push({ clientId: client.id, status: 'failed', reason: err.message });
      }
    }

    const invoiced = results.filter((r) => r.status === 'invoiced').length;
    const skipped = results.filter((r) => r.status === 'skipped').length;
    const failed = results.filter((r) => r.status === 'failed').length;

    return NextResponse.json({
      ok: true,
      message: `Invoiced ${invoiced}, skipped ${skipped}, failed ${failed} (of ${dueClients.length} due)`,
      results,
    });
  } catch (err: any) {
    console.error('[generate-recurring-invoices] Fatal error:', err);
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}