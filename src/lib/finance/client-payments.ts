// src/lib/finance/client-payments.ts
//
// Shared money logic for Financials 2 → Client Payments and the overview card.
//
// Revenue for a month = money RECEIVED in that month:
//   • Stripe: Invoice.amountPaid, bucketed by Invoice.paidAt
//   • Manual: ClientManualPayment.amount (cash/check/Zelle/wire), bucketed by
//     receivedAt, voided entries excluded
// A manual payment linked to an invoice is counted once — through the manual
// table. The Stripe invoice row itself is never edited (Stripe webhooks own
// it); the effective paid amount is derived: amountPaid + manual payments.
//
// All amounts here are integer CENTS.

import { and, gte, inArray, isNull, lt, notInArray, sql } from 'drizzle-orm';
import type { getDbHttp } from '@/lib/db';
import { invoice as invoiceTable, clientManualPayment as manualTable } from '@/lib/db/schema';

type Db = ReturnType<typeof getDbHttp>;

export const NON_REVENUE_INVOICE_STATUSES = ['CANCELED', 'REFUNDED'] as const;

export const num = (v: unknown): number => {
  if (v === null || v === undefined) return 0;
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
};

/** "YYYY-MM" (UTC) of an ISO string / Date. */
export const toMonthKey = (d: Date) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

export function monthBounds(monthParam: string | null): { start: Date; end: Date; label: string } {
  const now = new Date();
  let year = now.getUTCFullYear();
  let month = now.getUTCMonth();
  if (monthParam && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam)) {
    year = Number(monthParam.slice(0, 4));
    month = Number(monthParam.slice(5, 7)) - 1;
  }
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 1));
  return { start, end, label: toMonthKey(start) };
}

/** Cash received per calendar month in [startIso, endIso), split Stripe vs manual. */
export async function getRevenueByMonth(db: Db, startIso: string, endIso: string) {
  const [stripeRows, manualRows] = await Promise.all([
    db
      .select({
        month: sql<string>`to_char(${invoiceTable.paidAt}, 'YYYY-MM')`,
        cents: sql<string>`coalesce(sum(${invoiceTable.amountPaid}), 0)`,
      })
      .from(invoiceTable)
      .where(and(
        gte(invoiceTable.paidAt, startIso),
        lt(invoiceTable.paidAt, endIso),
        notInArray(invoiceTable.status, [...NON_REVENUE_INVOICE_STATUSES]),
      ))
      .groupBy(sql`1`),
    db
      .select({
        month: sql<string>`to_char(${manualTable.receivedAt}, 'YYYY-MM')`,
        cents: sql<string>`coalesce(sum(${manualTable.amount}), 0)`,
      })
      .from(manualTable)
      .where(and(
        gte(manualTable.receivedAt, startIso),
        lt(manualTable.receivedAt, endIso),
        isNull(manualTable.voidedAt),
      ))
      .groupBy(sql`1`),
  ]);

  const byMonth = new Map<string, { stripeCents: number; manualCents: number }>();
  const slot = (m: string) => {
    let s = byMonth.get(m);
    if (!s) byMonth.set(m, (s = { stripeCents: 0, manualCents: 0 }));
    return s;
  };
  for (const r of stripeRows) slot(r.month).stripeCents += num(r.cents);
  for (const r of manualRows) slot(r.month).manualCents += num(r.cents);
  return byMonth;
}

/** Non-voided manual payments applied to the given invoices: invoiceId -> cents. */
export async function getManualPaidByInvoice(db: Db, invoiceIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (invoiceIds.length === 0) return out;
  const rows = await db
    .select({
      invoiceId: manualTable.invoiceId,
      cents: sql<string>`coalesce(sum(${manualTable.amount}), 0)`,
    })
    .from(manualTable)
    .where(and(inArray(manualTable.invoiceId, invoiceIds), isNull(manualTable.voidedAt)))
    .groupBy(manualTable.invoiceId);
  for (const r of rows) if (r.invoiceId) out.set(r.invoiceId, num(r.cents));
  return out;
}

/**
 * Status to show once manual payments are taken into account. Cancelled /
 * refunded / draft invoices keep their own status.
 */
export function effectiveInvoiceStatus(rawStatus: string, amount: number, paid: number): string {
  if (['CANCELED', 'REFUNDED', 'DRAFT'].includes(rawStatus)) return rawStatus;
  if (amount > 0 && paid >= amount) return 'PAID';
  if (paid > 0) return rawStatus === 'OVERDUE' ? 'OVERDUE' : 'PARTIALLY_PAID';
  return rawStatus;
}
