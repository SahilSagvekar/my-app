export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { invoice as invoiceTable, stripeCustomer } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getUserFromToken, requireAdmin } from '@/lib/auth-helpers';
import { resolveClientIdForUser } from '@/lib/auth';
import {
  stripe,
  sendStripeInvoice,
  createInvoiceCheckoutSession,
  formatAmount
} from '@/lib/stripe';

// GET - Get single invoice
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const db = getDbHttp();
  try {
    const { id } = await params;
    const currentUser = getUserFromToken(req);
    
    if (!currentUser) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    const rawInvoice = await db.query.invoice.findFirst({
      where: eq(invoiceTable.id, id),
      with: {
        stripeCustomer: {
          with: {
            client: {
              columns: { id: true, name: true, companyName: true, email: true },
            },
          },
        },
        user: {
          columns: { id: true, name: true },
        },
        payments: {
          orderBy: (p, { desc }) => desc(p.createdAt),
        },
      },
    });

    if (!rawInvoice) {
      return NextResponse.json({ ok: false, message: 'Invoice not found' }, { status: 404 });
    }
    const { user: creator, ...invoice } = rawInvoice as any;
    const invoiceWithCreator = { ...invoice, creator };

    // Check access for client users
    if (currentUser.role === 'client') {
      const resolvedClientId = await resolveClientIdForUser(currentUser.userId || currentUser.id);
      const [clientStripeCustomer] = resolvedClientId
        ? await db.select().from(stripeCustomer).where(eq(stripeCustomer.clientId, resolvedClientId)).limit(1)
        : [null];
      if (!clientStripeCustomer || clientStripeCustomer.id !== invoice.stripeCustomerId) {
        return NextResponse.json({ ok: false, message: 'Access denied' }, { status: 403 });
      }
    }

    return NextResponse.json({ ok: true, invoice: invoiceWithCreator });
  } catch (error: any) {
    console.error('Error fetching invoice:', error);
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }
}

// PATCH - Update invoice or perform actions (send, void, etc.)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const db = getDbHttp();
  try {
    const { id } = await params;
    const currentUser = getUserFromToken(req);
    
    if (!currentUser) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, ...updateData } = body;

    const invoice = await db.query.invoice.findFirst({
      where: eq(invoiceTable.id, id),
      with: {
        stripeCustomer: {
          with: {
            client: true,
          },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json({ ok: false, message: 'Invoice not found' }, { status: 404 });
    }

    // Handle specific actions
    if (action === 'send') {
      // Admin only
      const authError = requireAdmin(currentUser);
      if (authError) {
        return NextResponse.json({ ok: false, message: authError.error }, { status: authError.status });
      }

      if (invoice.status !== 'DRAFT') {
        return NextResponse.json({ ok: false, message: 'Only draft invoices can be sent' }, { status: 400 });
      }

      let stripeHostedInvoiceUrl = invoice.stripeHostedInvoiceUrl;
      let stripePdfUrl = invoice.stripePdfUrl;

      // Send via Stripe if we have a Stripe invoice
      if (invoice.stripeInvoiceId) {
        const sentInvoice = await sendStripeInvoice(invoice.stripeInvoiceId);
        stripeHostedInvoiceUrl = sentInvoice.hosted_invoice_url;
        stripePdfUrl = sentInvoice.invoice_pdf;
      }

      await db.update(invoiceTable).set({
        status: 'SENT',
        sentAt: new Date().toISOString(),
        stripeHostedInvoiceUrl,
        stripePdfUrl,
        updatedAt: new Date().toISOString(),
      }).where(eq(invoiceTable.id, id));

      const updatedInvoice = await db.query.invoice.findFirst({
        where: eq(invoiceTable.id, id),
        with: { stripeCustomer: { with: { client: true } } },
      });

      // TODO: Send email notification to client
      // await sendInvoiceEmail(updatedInvoice);

      return NextResponse.json({ ok: true, invoice: updatedInvoice });
    }

    if (action === 'void' || action === 'cancel') {
      const authError = requireAdmin(currentUser);
      if (authError) {
        return NextResponse.json({ ok: false, message: authError.error }, { status: authError.status });
      }

      if (invoice.status === 'PAID') {
        return NextResponse.json({ ok: false, message: 'Cannot void a paid invoice' }, { status: 400 });
      }

      // Void in Stripe if exists
      if (invoice.stripeInvoiceId) {
        try {
          await stripe.invoices.voidInvoice(invoice.stripeInvoiceId);
        } catch (e) {
          console.error('Failed to void Stripe invoice:', e);
        }
      }

      const [updatedInvoice] = await db.update(invoiceTable).set({
        status: 'CANCELED',
        updatedAt: new Date().toISOString(),
      }).where(eq(invoiceTable.id, id)).returning();

      return NextResponse.json({ ok: true, invoice: updatedInvoice });
    }

    if (action === 'pay') {
      // Clients may only pay their own invoice — mirrors the GET ownership check.
      if (currentUser.role === 'client') {
        const resolvedClientId = await resolveClientIdForUser(currentUser.userId || currentUser.id);
        const [clientStripeCustomer] = resolvedClientId
          ? await db.select().from(stripeCustomer).where(eq(stripeCustomer.clientId, resolvedClientId)).limit(1)
          : [null];
        if (!clientStripeCustomer || clientStripeCustomer.id !== invoice.stripeCustomerId) {
          return NextResponse.json({ ok: false, message: 'Access denied' }, { status: 403 });
        }
      }

      if (invoice.status === 'PAID') {
        return NextResponse.json({ ok: false, message: 'Invoice is already paid' }, { status: 400 });
      }

      // Idempotency: a double-click (or a retry before the redirect fires)
      // must not create a second Checkout session for the same invoice.
      const recentSessions = await stripe.checkout.sessions.list({
        customer: invoice.stripeCustomer.stripeCustomerId,
        limit: 10,
      });
      const reusableSession = recentSessions.data.find(
        (s) => s.status === 'open' && s.metadata?.invoiceId === invoice.id
      );
      if (reusableSession) {
        return NextResponse.json({ ok: true, checkoutUrl: reusableSession.url });
      }

      // Create checkout session for payment
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

      const session = await createInvoiceCheckoutSession(
        invoice.stripeCustomer.stripeCustomerId,
        invoice.id,
        invoice.amount - invoice.amountPaid, // Remaining amount
        `Invoice ${invoice.invoiceNumber}${invoice.description ? ` - ${invoice.description}` : ''}`,
        `${baseUrl}/billing/invoices/${invoice.id}?payment=success`,
        `${baseUrl}/billing/invoices/${invoice.id}?payment=canceled`
      );

      return NextResponse.json({ ok: true, checkoutUrl: session.url });
    }

    // Regular update (admin only)
    const authError = requireAdmin(currentUser);
    if (authError) {
      return NextResponse.json({ ok: false, message: authError.error }, { status: authError.status });
    }

    if (invoice.status !== 'DRAFT') {
      return NextResponse.json({ ok: false, message: 'Only draft invoices can be edited' }, { status: 400 });
    }

    const allowedFields = ['description', 'notes', 'dueDate', 'lineItems'];
    const filteredUpdate: any = {};
    
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        filteredUpdate[field] = updateData[field];
      }
    }

    // Recalculate amount if lineItems changed
    if (filteredUpdate.lineItems) {
      filteredUpdate.amount = filteredUpdate.lineItems.reduce(
        (sum: number, item: any) => sum + item.amount * (item.quantity || 1),
        0
      );
    }

    await db.update(invoiceTable).set({
      ...filteredUpdate,
      ...(filteredUpdate.dueDate && { dueDate: new Date(filteredUpdate.dueDate).toISOString() }),
      updatedAt: new Date().toISOString(),
    }).where(eq(invoiceTable.id, id));

    const updatedInvoice = await db.query.invoice.findFirst({
      where: eq(invoiceTable.id, id),
      with: { stripeCustomer: { with: { client: true } } },
    });

    return NextResponse.json({ ok: true, invoice: updatedInvoice });
  } catch (error: any) {
    console.error('Error updating invoice:', error);
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }
}

// DELETE - Delete draft invoice
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const db = getDbHttp();
  try {
    const { id } = await params;
    const currentUser = getUserFromToken(req);
    const authError = requireAdmin(currentUser);
    
    if (authError) {
      return NextResponse.json({ ok: false, message: authError.error }, { status: authError.status });
    }

    const [invoice] = await db.select().from(invoiceTable).where(eq(invoiceTable.id, id)).limit(1);

    if (!invoice) {
      return NextResponse.json({ ok: false, message: 'Invoice not found' }, { status: 404 });
    }

    if (invoice.status !== 'DRAFT') {
      return NextResponse.json({ ok: false, message: 'Only draft invoices can be deleted' }, { status: 400 });
    }

    // Delete Stripe invoice if exists
    if (invoice.stripeInvoiceId) {
      try {
        await stripe.invoices.del(invoice.stripeInvoiceId);
      } catch (e) {
        console.error('Failed to delete Stripe invoice:', e);
      }
    }

    await db.delete(invoiceTable).where(eq(invoiceTable.id, id));

    return NextResponse.json({ ok: true, message: 'Invoice deleted' });
  } catch (error: any) {
    console.error('Error deleting invoice:', error);
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }
}