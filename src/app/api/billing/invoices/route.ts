export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken, requireAdmin } from '@/lib/auth-helpers';
import { 
  generateInvoiceNumber, 
  getOrCreateStripeCustomer, 
  createStripeInvoice,
  sendStripeInvoice,
  toCents 
} from '@/lib/stripe';

// GET - List invoices (with filters)
export async function GET(req: NextRequest) {
  try {
    const currentUser = getUserFromToken(req);
    if (!currentUser) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('clientId');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    // If client user, only show their invoices
    if (currentUser.role === 'client' && currentUser.linkedClientId) {
      const stripeCustomer = await prisma.stripeCustomer.findUnique({
        where: { clientId: currentUser.linkedClientId },
      });
      if (stripeCustomer) {
        where.stripeCustomerId = stripeCustomer.id;
      } else {
        return NextResponse.json({ ok: true, invoices: [], total: 0 });
      }
    } else if (clientId) {
      const stripeCustomer = await prisma.stripeCustomer.findUnique({
        where: { clientId },
      });
      if (stripeCustomer) {
        where.stripeCustomerId = stripeCustomer.id;
      }
    }

    if (status) {
      where.status = status;
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
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
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.invoice.count({ where }),
    ]);

    return NextResponse.json({
      ok: true,
      invoices,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    console.error('Error fetching invoices:', error);
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }
}

// POST - Create a new invoice
export async function POST(req: NextRequest) {
  try {
    const currentUser = getUserFromToken(req);
    const authError = requireAdmin(currentUser);
    if (authError) {
      return NextResponse.json({ ok: false, message: authError.error }, { status: authError.status });
    }

    const body = await req.json();
    const {
      clientId,
      lineItems, // Array of { description, amount (in dollars), quantity }
      dueDate,
      description,
      notes,
      sendImmediately = false,
      useStripeInvoicing = true, // Whether to create Stripe invoice or just local
    } = body;

    if (!clientId || !lineItems || lineItems.length === 0) {
      return NextResponse.json(
        { ok: false, message: 'clientId and lineItems are required' },
        { status: 400 }
      );
    }

    // Get client
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, name: true, companyName: true, email: true },
    });

    if (!client) {
      return NextResponse.json({ ok: false, message: 'Client not found' }, { status: 404 });
    }

    // Get or create Stripe customer
    const stripeCustomer = await getOrCreateStripeCustomer(
      client.id,
      client.email,
      client.companyName || client.name
    );

    // Get our StripeCustomer record
    const dbStripeCustomer = await prisma.stripeCustomer.findUnique({
      where: { stripeCustomerId: stripeCustomer.id },
    });

    if (!dbStripeCustomer) {
      return NextResponse.json({ ok: false, message: 'Failed to create customer' }, { status: 500 });
    }

    // Calculate totals - with validation
    const processedLineItems = lineItems
      .filter((item: any) => {
        const amount = parseFloat(item.amount);
        return item.description && !isNaN(amount) && amount > 0;
      })
      .map((item: any) => ({
        description: item.description,
        amount: toCents(parseFloat(item.amount)),
        quantity: item.quantity || 1,
      }));

    if (processedLineItems.length === 0) {
      return NextResponse.json(
        { ok: false, message: 'No valid line items with amounts greater than $0' },
        { status: 400 }
      );
    }

    const totalAmount = processedLineItems.reduce(
      (sum: number, item: any) => sum + item.amount * item.quantity,
      0
    );

    if (totalAmount <= 0) {
      return NextResponse.json(
        { ok: false, message: 'Invoice total must be greater than $0' },
        { status: 400 }
      );
    }

    console.log('📄 Creating invoice with line items:', processedLineItems);
    console.log('📄 Total amount (cents):', totalAmount);

    // Generate invoice number
    const invoiceNumber = generateInvoiceNumber();

    let stripeInvoiceId = null;
    let stripeHostedInvoiceUrl = null;
    let stripePdfUrl = null;

    // Create Stripe invoice if requested
    if (useStripeInvoicing) {
      const daysUntilDue = dueDate
        ? Math.max(1, Math.ceil((new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : 30;

      const stripeInvoice = await createStripeInvoice(
        stripeCustomer.id,
        processedLineItems.map((item: any) => ({
          description: item.description,
          amount: item.amount * item.quantity,
        })),
        daysUntilDue,
        { invoiceNumber, clientId }
      );

      stripeInvoiceId = stripeInvoice.id;

      // Send immediately if requested
      if (sendImmediately) {
        const sentInvoice = await sendStripeInvoice(stripeInvoice.id);
        stripeHostedInvoiceUrl = sentInvoice.hosted_invoice_url;
        stripePdfUrl = sentInvoice.invoice_pdf;
      }
    }

    // Create invoice in our database
    const invoice = await prisma.invoice.create({
      data: {
        stripeCustomerId: dbStripeCustomer.id,
        stripeInvoiceId,
        invoiceNumber,
        status: sendImmediately ? 'SENT' : 'DRAFT',
        amount: totalAmount,
        currency: 'usd',
        dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        description,
        lineItems: processedLineItems,
        notes,
        stripeHostedInvoiceUrl,
        stripePdfUrl,
        createdBy: currentUser.userId,
        sentAt: sendImmediately ? new Date() : null,
      },
      include: {
        stripeCustomer: {
          include: {
            client: {
              select: { id: true, name: true, companyName: true, email: true },
            },
          },
        },
      },
    });

    return NextResponse.json({ ok: true, invoice });
  } catch (error: any) {
    console.error('Error creating invoice:', error);
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }
}