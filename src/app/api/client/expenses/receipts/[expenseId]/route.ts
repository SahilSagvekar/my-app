export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { clientExpense, expenseTrip, user as userTable } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { getUserFromToken } from '@/lib/auth-helpers';
import { generateSignedUrl } from '@/lib/s3';

export async function GET(req: NextRequest, context: { params: Promise<{ expenseId: string }> }) {
  const db = getDbHttp();
  try {
    const session = getUserFromToken(req);
    if (!session || session.role?.toLowerCase() !== 'client') {
      return NextResponse.json({ error: 'Client access required' }, { status: 403 });
    }
    const account = await db.query.user.findFirst({
      where: eq(userTable.id, session.userId || session.id), with: { clients: true },
    });
    const clientId = account?.linkedClientId || account?.clients?.[0]?.id;
    const { expenseId } = await context.params;
    if (!clientId) return NextResponse.json({ error: 'No client account linked to this user' }, { status: 404 });

    const [row] = await db.select({ key: clientExpense.receiptS3Key })
      .from(clientExpense).innerJoin(expenseTrip, eq(clientExpense.tripId, expenseTrip.id))
      .where(and(eq(clientExpense.id, expenseId), eq(expenseTrip.clientId, clientId))).limit(1);
    if (!row) return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });

    return NextResponse.redirect(await generateSignedUrl(row.key, 300));
  } catch (error) {
    console.error('[client expense receipt GET]', error);
    return NextResponse.json({ error: 'Unable to open receipt' }, { status: 500 });
  }
}
