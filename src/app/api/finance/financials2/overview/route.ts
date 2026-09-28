export const dynamic = 'force-dynamic';

// src/app/api/finance/financials2/overview/route.ts
//
// One shot summary for the "Financials 2" card grid — real numbers, scoped
// to a single calendar month (default: the current month), for each of the
// six modules (Ledger, Client Payments, Contractors, Payroll, Expenses,
// Reports & KPIs).
//
// Notes on where the numbers come from, since it's a mix of the brand-new
// Financials 2 tables (LedgerEntry, Contractor, ContractorPayment, Expense,
// FinancialGoal — all empty until someone actually uses those modules) and
// the app's existing money tables (Invoice, Payroll):
//
//   - Client Payments and Payroll read from the EXISTING Invoice/Payroll
//     tables, so these numbers are real from day one.
//   - Contractors and Expenses read from the NEW Contractor/Expense tables,
//     so these will genuinely be zero until contractors/expenses are added
//     — that's correct behavior, not a bug, since nothing has been entered
//     there yet.
//   - Ledger reads from the NEW LedgerEntry table, which nothing writes to
//     yet (Invoice payments / payroll runs aren't hooked into it). It will
//     read zero until that hookup exists. Reports & KPIs' revenue figure
//     deliberately uses Invoice collections directly (not the ledger) so it
//     reflects real money now rather than waiting on that hookup.
//
// Invoice.amount/amountPaid are stored in cents; everything else
// (LedgerEntry, Payroll, Contractor*, Expense, FinancialGoal) is stored as
// plain decimal dollars. All dollar figures below are normalized to plain
// dollars before being combined.

import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import {
  invoice as invoiceTable,
  payroll as payrollTable,
  ledgerEntry as ledgerEntryTable,
  contractor as contractorTable,
  contractorPayment as contractorPaymentTable,
  expense as expenseTable,
  financialGoal as financialGoalTable,
} from '@/lib/db/schema';
import { and, asc, eq, gte, lt, notInArray } from 'drizzle-orm';
import { getUserFromToken, requireAdmin } from '@/lib/auth-helpers';

/** YYYY-MM-01T00:00:00Z .. next month's YYYY-MM-01T00:00:00Z, for a "YYYY-MM" input. */
function monthRange(monthParam: string | null): { start: Date; end: Date; label: string } {
  const now = new Date();
  let year = now.getUTCFullYear();
  let month = now.getUTCMonth(); // 0-indexed

  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    year = Number(monthParam.slice(0, 4));
    month = Number(monthParam.slice(5, 7)) - 1;
  }

  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 1));
  const label = `${year}-${String(month + 1).padStart(2, '0')}`;
  return { start, end, label };
}

const num = (v: unknown): number => {
  if (v === null || v === undefined) return 0;
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
};

export async function GET(req: NextRequest) {
  const db = getDbHttp();
  try {
    const currentUser = getUserFromToken(req);
    const adminCheck = requireAdmin(currentUser);
    if (adminCheck) {
      return NextResponse.json({ ok: false, message: adminCheck.error }, { status: adminCheck.status });
    }

    const { searchParams } = new URL(req.url);
    const { start, end, label } = monthRange(searchParams.get('month'));
    const startIso = start.toISOString();
    const endIso = end.toISOString();
    const nowIso = new Date().toISOString();

    const [
      ledgerRows,
      invoicesDueThisMonth,
      invoicesCollectedThisMonth,
      overdueInvoices,
      contractorCounts,
      contractorPaymentsThisMonth,
      payrollPaidThisMonth,
      payrollNextPending,
      expensePendingApproval,
      expensesReimbursedThisMonth,
      expensesSubmittedThisMonth,
      revenueGoal,
    ] = await Promise.all([
      // Ledger: every entry dated within the month.
      db
        .select({ amount: ledgerEntryTable.amount })
        .from(ledgerEntryTable)
        .where(and(gte(ledgerEntryTable.date, startIso), lt(ledgerEntryTable.date, endIso))),

      // Client Payments: invoices due this month, still owing something.
      db
        .select({ amount: invoiceTable.amount, amountPaid: invoiceTable.amountPaid })
        .from(invoiceTable)
        .where(and(
          gte(invoiceTable.dueDate, startIso),
          lt(invoiceTable.dueDate, endIso),
          notInArray(invoiceTable.status, ['CANCELED', 'REFUNDED']),
        )),

      // Client Payments: what actually came in this month.
      db
        .select({ amountPaid: invoiceTable.amountPaid })
        .from(invoiceTable)
        .where(and(gte(invoiceTable.paidAt, startIso), lt(invoiceTable.paidAt, endIso))),

      // Client Payments: overdue right now (not month-scoped — overdue is a
      // current state, not something that belongs to one calendar month).
      db
        .select({ id: invoiceTable.id })
        .from(invoiceTable)
        .where(eq(invoiceTable.status, 'OVERDUE')),

      // Contractors: active / W-9 pending are current-state counts.
      db
        .select({ status: contractorTable.status, w9Status: contractorTable.w9Status })
        .from(contractorTable),

      // Contractors: paid out this month.
      db
        .select({ amount: contractorPaymentTable.amount })
        .from(contractorPaymentTable)
        .where(and(gte(contractorPaymentTable.date, startIso), lt(contractorPaymentTable.date, endIso))),

      // Payroll: paid this month.
      db
        .select({ netPay: payrollTable.netPay })
        .from(payrollTable)
        .where(and(
          eq(payrollTable.status, 'PAID'),
          gte(payrollTable.paidAt, startIso),
          lt(payrollTable.paidAt, endIso),
        )),

      // Payroll: the next upcoming pending run (any period, not just this month).
      db
        .select({ periodEnd: payrollTable.periodEnd })
        .from(payrollTable)
        .where(and(eq(payrollTable.status, 'PENDING'), gte(payrollTable.periodEnd, nowIso)))
        .orderBy(asc(payrollTable.periodEnd))
        .limit(1),

      // Expenses: pending approval right now (current state, actionable regardless of month).
      db
        .select({ id: expenseTable.id })
        .from(expenseTable)
        .where(eq(expenseTable.status, 'SUBMITTED')),

      // Expenses: reimbursed this month.
      db
        .select({ amount: expenseTable.amount })
        .from(expenseTable)
        .where(and(
          eq(expenseTable.status, 'REIMBURSED'),
          gte(expenseTable.reimbursedAt, startIso),
          lt(expenseTable.reimbursedAt, endIso),
        )),

      // Expenses: submitted this month (for reference / KPIs).
      db
        .select({ amount: expenseTable.amount })
        .from(expenseTable)
        .where(and(gte(expenseTable.createdAt, startIso), lt(expenseTable.createdAt, endIso))),

      // Reports & KPIs: any REVENUE goal whose period overlaps this month.
      db
        .select({
          id: financialGoalTable.id,
          name: financialGoalTable.name,
          targetAmount: financialGoalTable.targetAmount,
          period: financialGoalTable.period,
          startDate: financialGoalTable.startDate,
          endDate: financialGoalTable.endDate,
        })
        .from(financialGoalTable)
        .where(and(
          eq(financialGoalTable.metricType, 'REVENUE'),
          lt(financialGoalTable.startDate, endIso),
          gte(financialGoalTable.endDate, startIso),
        ))
        .limit(1),
    ]);

    // ---- Ledger ----
    let ledgerMoneyIn = 0;
    let ledgerMoneyOut = 0;
    for (const row of ledgerRows) {
      const amt = num(row.amount);
      if (amt >= 0) ledgerMoneyIn += amt;
      else ledgerMoneyOut += Math.abs(amt);
    }

    // ---- Client Payments (Invoice amounts are cents) ----
    const outstandingCents = invoicesDueThisMonth.reduce(
      (sum, inv) => sum + Math.max(0, num(inv.amount) - num(inv.amountPaid)),
      0,
    );
    const collectedCents = invoicesCollectedThisMonth.reduce((sum, inv) => sum + num(inv.amountPaid), 0);
    const overdueCount = overdueInvoices.length;

    // ---- Contractors ----
    const activeContractors = contractorCounts.filter((c) => c.status === 'ACTIVE').length;
    const w9PendingCount = contractorCounts.filter((c) => c.w9Status === 'PENDING').length;
    const contractorsPaidThisMonth = contractorPaymentsThisMonth.reduce((sum, p) => sum + num(p.amount), 0);

    // ---- Payroll ----
    const payrollTotalThisMonth = payrollPaidThisMonth.reduce((sum, p) => sum + num(p.netPay), 0);
    const nextRunDate = payrollNextPending[0]?.periodEnd ?? null;

    // ---- Expenses ----
    const pendingApprovalCount = expensePendingApproval.length;
    const reimbursedThisMonth = expensesReimbursedThisMonth.reduce((sum, e) => sum + num(e.amount), 0);
    const submittedThisMonthTotal = expensesSubmittedThisMonth.reduce((sum, e) => sum + num(e.amount), 0);

    // ---- Reports & KPIs ----
    // Revenue: real cash collected this month (Invoice), converted to dollars,
    // plus any ledger income already recorded directly (avoids double
    // counting once the ledger hookup lands, since ledger entries sourced
    // from a Payment will have sourceType CLIENT_PAYMENT — until that
    // hookup exists this second term is just 0).
    const revenue = collectedCents / 100 + ledgerMoneyIn;
    const expensesTotal = payrollTotalThisMonth + contractorsPaidThisMonth + reimbursedThisMonth + ledgerMoneyOut;
    const profitMarginPct = revenue > 0 ? ((revenue - expensesTotal) / revenue) * 100 : null;

    const goalRow = revenueGoal[0] ?? null;
    const goal = goalRow
      ? {
          name: goalRow.name,
          targetAmount: num(goalRow.targetAmount),
          period: goalRow.period,
          progressPct: num(goalRow.targetAmount) > 0 ? (revenue / num(goalRow.targetAmount)) * 100 : null,
        }
      : null;

    return NextResponse.json({
      ok: true,
      month: label,
      ledger: {
        moneyIn: ledgerMoneyIn,
        moneyOut: ledgerMoneyOut,
      },
      clientPayments: {
        outstandingCents,
        collectedCents,
        overdueCount,
      },
      contractors: {
        activeCount: activeContractors,
        w9PendingCount,
        paidThisMonth: contractorsPaidThisMonth,
      },
      payroll: {
        totalThisMonth: payrollTotalThisMonth,
        nextRunDate,
      },
      expenses: {
        pendingApprovalCount,
        reimbursedThisMonth,
        submittedThisMonthTotal,
      },
      reports: {
        revenue,
        expensesTotal,
        profitMarginPct,
        goal,
      },
    });
  } catch (err: any) {
    console.error('[financials2/overview] Fatal error:', err);
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}