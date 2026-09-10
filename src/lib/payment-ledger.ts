// src/lib/payment-ledger.ts
//
// Keeps MonthlyPaymentLedger (one row per client per calendar month) in
// sync automatically as real payments land — called from the Stripe
// webhook, not computed on a schedule. What this feeds into is still open;
// for now it's just an accurate running total per client per month.

import { monthlyPaymentLedger } from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { and, eq, sql } from 'drizzle-orm';

export async function recordPaymentInLedger(
  db: any, // accepts either getDbHttp() or a transaction handle — both share this query shape
  clientId: string | null | undefined,
  amountCents: number,
  currency: string = 'usd'
): Promise<void> {
  if (!clientId || !amountCents || amountCents <= 0) return;

  const month = new Date().toISOString().slice(0, 7); // 'YYYY-MM'

  try {
    const [existing] = await db.select().from(monthlyPaymentLedger).where(
      and(eq(monthlyPaymentLedger.clientId, clientId), eq(monthlyPaymentLedger.month, month))
    ).limit(1);

    if (existing) {
      await db.update(monthlyPaymentLedger).set({
        totalPaidCents: sql`${monthlyPaymentLedger.totalPaidCents} + ${amountCents}`,
        paymentCount: sql`${monthlyPaymentLedger.paymentCount} + 1`,
        updatedAt: new Date().toISOString(),
      }).where(eq(monthlyPaymentLedger.id, existing.id));
    } else {
      await db.insert(monthlyPaymentLedger).values({
        id: createId(),
        clientId,
        month,
        totalPaidCents: amountCents,
        paymentCount: 1,
        currency,
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (err: any) {
    // Never let ledger bookkeeping block the actual payment from being
    // recorded — same defensive pattern as captureTechFeeFromCharge.
    console.error(`❌ [Payment Ledger] Failed to record payment for client ${clientId}:`, err.message);
  }
}