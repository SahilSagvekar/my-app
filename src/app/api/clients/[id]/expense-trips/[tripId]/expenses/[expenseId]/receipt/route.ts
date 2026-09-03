export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { clientExpense, expenseTrip } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { getUserFromToken, requireAdmin } from '@/lib/auth-helpers';
import { generateSignedUrl } from '@/lib/s3';

export async function GET(req: NextRequest, context: { params: Promise<{ id: string; tripId: string; expenseId: string }> }) {
  const db = getDbHttp();
  try {
    const adminCheck = requireAdmin(getUserFromToken(req));
    if (adminCheck) return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
    const { id: clientId, tripId, expenseId } = await context.params;
    const [row] = await db.select({ key: clientExpense.receiptS3Key })
      .from(clientExpense).innerJoin(expenseTrip, eq(clientExpense.tripId, expenseTrip.id))
      .where(and(eq(clientExpense.id, expenseId), eq(clientExpense.tripId, tripId), eq(expenseTrip.clientId, clientId))).limit(1);
    if (!row) return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
    return NextResponse.redirect(await generateSignedUrl(row.key, 300));
  } catch (error) {
    console.error('[admin expense receipt GET]', error);
    return NextResponse.json({ error: 'Unable to open receipt' }, { status: 500 });
  }
}
