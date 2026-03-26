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

    // Check if user is a client - need to fetch from DB since linkedClientId isn't in JWT
    const isClientRole = currentUser.role === 'client' || currentUser.role === 'CLIENT';
    
    if (isClientRole) {
      // Fetch the user to get their linkedClientId
      const user = await prisma.user.findUnique({
        where: { id: currentUser.userId || currentUser.id },
        select: { linkedClientId: true },
      });

      if (!user?.linkedClientId) {
        console.log('Client user has no linkedClientId:', currentUser.userId);
        return NextResponse.json({ ok: true, invoices: [], total: 0 });
      }

      // Get the stripe customer for this client
      const stripeCustomer = await prisma.stripeCustomer.findUnique({
        where: { clientId: user.linkedClientId },
      });

      if (stripeCustomer) {
        where.stripeCustomerId = stripeCustomer.id;
      } else {
        // No stripe customer for this client - return empty
        return NextResponse.json({ ok: true, invoices: [], total: 0 });
      }
    } else if (clientId) {
      // Admin/manager filtering by specific client
      const stripeCustomer = await prisma.stripeCustomer.findUnique({
        where: { clientId },
      });
      if (stripeCustomer) {
        where.stripeCustomerId = stripeCustomer.id;
      } else {
        // No stripe customer for this client - return empty (not all invoices!)
        return NextResponse.json({ ok: true, invoices: [], total: 0 });
      }
    }
    // Note: If no clientId provided and user is admin, returns all invoices (for admin dashboard)

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
      taskIds = [], // IDs of one-off tasks to mark as billed
      invoiceType = 'STANDARD', // 'STANDARD' | 'ONE_OFF'
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
    console.log('📄 Invoice type:', invoiceType);
    console.log('📄 Task IDs to mark as billed:', taskIds);

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
        { invoiceNumber, clientId, invoiceType },
        description // Pass the invoice description to Stripe
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
        metadata: invoiceType === 'ONE_OFF' ? { invoiceType: 'ONE_OFF', taskIds } : undefined,
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

    // Mark tasks as billed (if any)
    if (taskIds.length > 0) {
      await prisma.task.updateMany({
        where: {
          id: { in: taskIds },
          clientId: clientId, // Security: ensure they belong to this client
          oneOffDeliverableId: { not: null }, // Must be one-off tasks
        },
        data: {
          billedAt: new Date(),
          invoiceId: invoice.id,
        },
      });
      console.log(`✅ Marked ${taskIds.length} one-off tasks as billed`);
    }

    return NextResponse.json({ ok: true, invoice });
  } catch (error: any) {
    console.error('Error creating invoice:', error);
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }
}