export const dynamic = 'force-dynamic';

// POST /api/clients/[id]/expense-trips/[tripId]/expenses
// Uploads a receipt (image/PDF) and creates the expense row for it. Expects
// multipart/form-data: file, description, amount (dollars, e.g. "42.50" —
// converted to cents here since that's how every other money column in the
// schema is stored), expenseDate (ISO date string, optional — defaults to
// today).

import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { expenseTrip, clientExpense } from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { uploadBufferToS3 } from '@/lib/s3';
import { toCents } from '@/lib/stripe';
import { eq } from 'drizzle-orm';
import { getUserFromToken, requireAdmin } from '@/lib/auth-helpers';

export async function POST(req: NextRequest, context: { params: Promise<{ id: string; tripId: string }> }) {
  const db = getDbHttp();
  try {
    const currentUser = getUserFromToken(req);
    const adminCheck = requireAdmin(currentUser);
    if (adminCheck) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
    }

    const { id: clientId, tripId } = await context.params;

    // Confirm the trip actually belongs to this client — prevents an
    // expense being attached to a trip under the wrong client via a
    // mismatched tripId in the URL.
    const [trip] = await db.select().from(expenseTrip).where(eq(expenseTrip.id, tripId)).limit(1);
    if (!trip || trip.clientId !== clientId) {
      return NextResponse.json({ error: 'Trip not found for this client' }, { status: 404 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const description = (formData.get('description') as string || '').trim();
    const amountRaw = formData.get('amount') as string | null;
    const expenseDateRaw = formData.get('expenseDate') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'Receipt file is required' }, { status: 400 });
    }
    const allowedTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
    const maxFileBytes = 10 * 1024 * 1024;
    if (!allowedTypes.has(file.type) || file.size > maxFileBytes) {
      return NextResponse.json({ error: 'Receipts must be a JPG, PNG, WebP, or PDF up to 10 MB' }, { status: 400 });
    }
    if (!description) {
      return NextResponse.json({ error: 'Description is required' }, { status: 400 });
    }
    const amountCents = toCents(amountRaw || '0');
    if (!amountCents || amountCents <= 0) {
      return NextResponse.json({ error: 'A valid amount is required' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const uploaded = await uploadBufferToS3({
      buffer,
      folderPrefix: `${clientId}/expenses/${tripId}/`,
      filename: `${createId()}-${file.name}`,
      mimeType: file.type,
    });

    const [expense] = await db.insert(clientExpense).values({
      id: createId(),
      tripId,
      description,
      amount: amountCents,
      expenseDate: expenseDateRaw ? new Date(expenseDateRaw).toISOString() : new Date().toISOString(),
      receiptS3Key: uploaded.key,
      receiptUrl: uploaded.url,
      receiptFileName: file.name,
      status: 'PENDING',
      createdById: Number(currentUser!.userId),
      updatedAt: new Date().toISOString(),
    }).returning();

    return NextResponse.json({
      expense: {
        ...expense,
        receiptS3Key: undefined,
        receiptUrl: `/api/clients/${clientId}/expense-trips/${tripId}/expenses/${expense.id}/receipt`,
      },
    });
  } catch (err: any) {
    console.error('[expenses POST] Fatal error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
