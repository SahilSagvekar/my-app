export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken, requireAdmin } from '@/lib/auth-helpers';
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
  try {
    const { id } = await params;
    const currentUser = getUserFromToken(req);
    
    if (!currentUser) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        stripeCustomer: {
          include: {
            client: {
              select: { id: true, name: true, companyName: true, email: true },
            },
          },
        },
        creator: {
          select: { id: true, name: true },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json({ ok: false, message: 'Invoice not found' }, { status: 404 });
    }

    // Check access for client users
    if (currentUser.role === 'client') {
      const clientStripeCustomer = await prisma.stripeCustomer.findUnique({
        where: { clientId: currentUser.linkedClientId || '' },
      });
      if (!clientStripeCustomer || clientStripeCustomer.id !== invoice.stripeCustomerId) {
        return NextResponse.json({ ok: false, message: 'Access denied' }, { status: 403 });
      }
    }

    return NextResponse.json({ ok: true, invoice });
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
  try {
    const { id } = await params;
    const currentUser = getUserFromToken(req);
    
    if (!currentUser) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, ...updateData } = body;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        stripeCustomer: {
          include: {
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

      const updatedInvoice = await prisma.invoice.update({
        where: { id },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          stripeHostedInvoiceUrl,
          stripePdfUrl,
        },
        include: {
          stripeCustomer: {
            include: { client: true },
          },
        },
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

      const updatedInvoice = await prisma.invoice.update({
        where: { id },
        data: { status: 'CANCELED' },
      });

      return NextResponse.json({ ok: true, invoice: updatedInvoice });
    }

    if (action === 'pay') {
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

    const updatedInvoice = await prisma.invoice.update({
      where: { id },
      data: filteredUpdate,
      include: {
        stripeCustomer: {
          include: { client: true },
        },
      },
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
  try {
    const { id } = await params;
    const currentUser = getUserFromToken(req);
    const authError = requireAdmin(currentUser);
    
    if (authError) {
      return NextResponse.json({ ok: false, message: authError.error }, { status: authError.status });
    }

    const invoice = await prisma.invoice.findUnique({ where: { id } });

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

    await prisma.invoice.delete({ where: { id } });

    return NextResponse.json({ ok: true, message: 'Invoice deleted' });
  } catch (error: any) {
    console.error('Error deleting invoice:', error);
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }
}