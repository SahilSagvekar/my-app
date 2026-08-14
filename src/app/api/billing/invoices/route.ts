export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { invoice, stripeCustomer as stripeCustomerTable, client as clientTable, task } from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { and, eq, inArray, isNotNull, desc, count as countFn } from 'drizzle-orm';
import { getUserFromToken, requireAdmin } from '@/lib/auth-helpers';
import { resolveClientIdForUser } from '@/lib/auth';
import { 
  generateInvoiceNumber, 
  getOrCreateStripeCustomer, 
  createStripeInvoice,
  sendStripeInvoice,
  toCents,
  stripe,
} from '@/lib/stripe';

// GET - List invoices (with filters)
export async function GET(req: NextRequest) {
  const { db, closeDb } = getDb();
  try {
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
    const conditions: any[] = [];

    // Check if user is a client - need to fetch from DB since linkedClientId isn't in JWT
    const isClientRole = currentUser.role === 'client' || currentUser.role === 'CLIENT';

    if (isClientRole) {
      const resolvedClientId = await resolveClientIdForUser(currentUser.userId || currentUser.id);

      if (!resolvedClientId) {
        console.log('Client user has no linked client:', currentUser.userId);
        return NextResponse.json({ ok: true, invoices: [], total: 0 });
      }

      // Get the stripe customer for this client
      const [foundStripeCustomer] = await db.select().from(stripeCustomerTable).where(eq(stripeCustomerTable.clientId, resolvedClientId)).limit(1);

      if (foundStripeCustomer) {
        conditions.push(eq(invoice.stripeCustomerId, foundStripeCustomer.id));
      } else {
        // No stripe customer for this client - return empty
        return NextResponse.json({ ok: true, invoices: [], total: 0 });
      }
    } else if (clientId) {
      // Admin/manager filtering by specific client
      const [foundStripeCustomer] = await db.select().from(stripeCustomerTable).where(eq(stripeCustomerTable.clientId, clientId)).limit(1);
      if (foundStripeCustomer) {
        conditions.push(eq(invoice.stripeCustomerId, foundStripeCustomer.id));
      } else {
        // No stripe customer for this client - return empty (not all invoices!)
        return NextResponse.json({ ok: true, invoices: [], total: 0 });
      }
    }
    // Note: If no clientId provided and user is admin, returns all invoices (for admin dashboard)

    if (status) {
      conditions.push(eq(invoice.status, status as any));
    }

    const where = conditions.length ? and(...conditions) : undefined;

    const [rawInvoices, [{ value: total }]] = await Promise.all([
      db.query.invoice.findMany({
        where,
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
        orderBy: desc(invoice.createdAt),
        offset: skip,
        limit,
      }),
      db.select({ value: countFn() }).from(invoice).where(where),
    ]);
    const invoices = rawInvoices.map(({ user: creator, ...inv }: any) => ({ ...inv, creator }));

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

  } finally {
    await closeDb();
  }
}

// POST - Create a new invoice
export async function POST(req: NextRequest) {
  const { db, closeDb } = getDb();
  try {
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
    const [client] = await db.select({ id: clientTable.id, name: clientTable.name, companyName: clientTable.companyName, email: clientTable.email })
      .from(clientTable).where(eq(clientTable.id, clientId)).limit(1);

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
    const [dbStripeCustomer] = await db.select().from(stripeCustomerTable).where(eq(stripeCustomerTable.stripeCustomerId, stripeCustomer.id)).limit(1);

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
    // Defaults to what the admin typed in; overwritten below with Stripe's
    // authoritative totals when a Stripe invoice is actually created, so any
    // pending Tech Fee item Stripe swept in is reflected locally too.
    let finalLineItems = processedLineItems;
    let finalTotalAmount = totalAmount;

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

      // Re-fetch so the local record reflects anything Stripe swept in
      // (e.g. a pending Tech Fees item), not just what was typed into this form.
      const authoritative = await stripe.invoices.retrieve(stripeInvoiceId);
      finalLineItems = authoritative.lines.data.map((line: any) => ({
        description: line.description || 'Line item',
        amount: line.amount,
        quantity: line.quantity || 1,
      }));
      finalTotalAmount = authoritative.total ?? authoritative.amount_due ?? totalAmount;
    }

    // Create invoice in our database
    const [createdInvoiceRow] = await db.insert(invoice).values({
      id: createId(),
      stripeCustomerId: dbStripeCustomer.id,
      stripeInvoiceId,
      invoiceNumber,
      status: sendImmediately ? 'SENT' : 'DRAFT',
      amount: finalTotalAmount,
      currency: 'usd',
      dueDate: (dueDate ? new Date(dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)).toISOString(),
      description,
      lineItems: finalLineItems,
      notes,
      stripeHostedInvoiceUrl,
      stripePdfUrl,
      createdBy: currentUser.userId,
      sentAt: sendImmediately ? new Date().toISOString() : null,
      metadata: invoiceType === 'ONE_OFF' ? { invoiceType: 'ONE_OFF', taskIds } : undefined,
      updatedAt: new Date().toISOString(),
    }).returning();

    const createdInvoice = await db.query.invoice.findFirst({
      where: eq(invoice.id, createdInvoiceRow.id),
      with: {
        stripeCustomer: {
          with: {
            client: {
              columns: { id: true, name: true, companyName: true, email: true },
            },
          },
        },
      },
    });

    // Mark tasks as billed (if any)
    if (taskIds.length > 0) {
      await db.update(task).set({
        billedAt: new Date().toISOString(),
        invoiceId: createdInvoiceRow.id,
        updatedAt: new Date().toISOString(),
      }).where(and(
        inArray(task.id, taskIds),
        eq(task.clientId, clientId), // Security: ensure they belong to this client
        isNotNull(task.oneOffDeliverableId), // Must be one-off tasks
      ));
      console.log(`✅ Marked ${taskIds.length} one-off tasks as billed`);
    }

    return NextResponse.json({ ok: true, invoice: createdInvoice });
  } catch (error: any) {
    console.error('Error creating invoice:', error);
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  } finally {
    await closeDb();
  }
}