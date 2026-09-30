"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "../../ui/card";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import {
  Landmark,
  Receipt,
  Users,
  Wallet,
  FileSpreadsheet,
  LineChart,
  Maximize2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Financials 2 — card-grid overview
//
// One card per module (Ledger, Client Payments, Contractors, Payroll,
// Expenses, Reports/KPIs). Each card shows a couple of key stats, scoped to
// the selected calendar month, and an expand icon that hands off to its own
// full-page view via onNavigate, following the same onPageChange page-switch
// pattern used everywhere else in AdminDashboard.
//
// Numbers come from /api/finance/financials2/overview. Ledger, Contractors
// and Expenses read from the brand-new Financials 2 tables, so they'll
// genuinely read 0 until those modules are actually used — that's real
// data, not a placeholder. Client Payments and Payroll read from the
// existing Invoice/Payroll tables, so those are populated from day one.
// ---------------------------------------------------------------------------

interface Financials2OverviewProps {
  onNavigate: (page: string) => void;
}

interface ModuleCard {
  id: string;
  title: string;
  icon: React.ElementType;
  iconColor: string;
  stats: { label: string; value: string }[];
  comingSoon?: boolean;
}

interface OverviewData {
  ok: boolean;
  month: string;
  ledger: { moneyIn: number; moneyOut: number };
  clientPayments: { outstandingCents: number; collectedCents: number; overdueCount: number };
  contractors: { activeCount: number; w9PendingCount: number; paidThisMonth: number };
  payroll: { totalThisMonth: number; nextRunDate: string | null };
  expenses: { pendingApprovalCount: number; loggedThisMonth: number; loggedCount: number; submittedThisMonthTotal: number };
  reports: {
    revenue: number;
    expensesTotal: number;
    profitMarginPct: number | null;
    goal: { name: string; targetAmount: number; period: string; progressPct: number | null } | null;
  };
}

const formatUsd = (amount: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    amount || 0,
  );

const centsToUsd = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    (cents || 0) / 100,
  );

const formatShortDate = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

/** "2026-09" -> "September 2026" */
const formatMonthLabel = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return month;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
};

const shiftMonth = (month: string, delta: number) => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

const currentMonth = () => {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
};

export function Financials2Overview({ onNavigate }: Financials2OverviewProps) {
  const [month, setMonth] = useState<string>(currentMonth());
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/finance/financials2/overview?month=${month}`, { credentials: "include" })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || !json.ok) throw new Error(json.message || "Failed to load financials data");
        return json as OverviewData;
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Failed to load financials data");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [month]);

  const moduleCards: ModuleCard[] = useMemo(() => {
    const v = (s: string) => (loading ? "…" : s);

    return [
      {
        id: "financials2-ledger",
        title: "Ledger",
        icon: Landmark,
        iconColor: "text-blue-600",
        stats: [
          { label: "Money in", value: data ? v(formatUsd(data.ledger.moneyIn)) : "—" },
          { label: "Money out", value: data ? v(formatUsd(data.ledger.moneyOut)) : "—" },
        ],
      },
      {
        id: "financials2-client-payments",
        title: "Client Payments",
        icon: FileSpreadsheet,
        iconColor: "text-green-600",
        stats: [
          { label: "Outstanding", value: data ? v(centsToUsd(data.clientPayments.outstandingCents)) : "—" },
          { label: "Overdue", value: data ? v(String(data.clientPayments.overdueCount)) : "—" },
        ],
      },
      {
        id: "financials2-contractors",
        title: "Contractors",
        icon: Users,
        iconColor: "text-purple-600",
        stats: [
          { label: "Active", value: data ? v(String(data.contractors.activeCount)) : "—" },
          { label: "W-9 pending", value: data ? v(String(data.contractors.w9PendingCount)) : "—" },
        ],
      },
      {
        id: "financials2-payroll",
        title: "Payroll",
        icon: Wallet,
        iconColor: "text-orange-600",
        stats: [
          { label: "This month", value: data ? v(formatUsd(data.payroll.totalThisMonth)) : "—" },
          { label: "Next run", value: data ? v(formatShortDate(data.payroll.nextRunDate)) : "—" },
        ],
      },
      {
        id: "financials2-expenses",
        title: "Expenses",
        icon: Receipt,
        iconColor: "text-red-600",
        stats: [
          { label: "Logged (mo.)", value: data ? v(formatUsd(data.expenses.loggedThisMonth)) : "—" },
          { label: "Entries", value: data ? v(String(data.expenses.loggedCount)) : "—" },
        ],
      },
      {
        id: "financials2-reports",
        title: "Reports & KPIs",
        icon: LineChart,
        iconColor: "text-teal-600",
        stats: [
          {
            label: "Profit margin",
            value: data
              ? v(data.reports.profitMarginPct === null ? "—" : `${data.reports.profitMarginPct.toFixed(0)}%`)
              : "—",
          },
          {
            label: "Revenue vs goal",
            value: data
              ? v(data.reports.goal?.progressPct != null ? `${data.reports.goal.progressPct.toFixed(0)}%` : "—")
              : "—",
          },
        ],
      },
    ];
  }, [data, loading]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[9rem] text-center text-sm font-medium">{formatMonthLabel(month)}</span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
            aria-label="Next month"
            disabled={month >= currentMonth()}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {month !== currentMonth() && (
          <Button variant="ghost" size="sm" onClick={() => setMonth(currentMonth())}>
            Back to this month
          </Button>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600">Couldn't load this month's numbers: {error}</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {moduleCards.map((module) => {
          const Icon = module.icon;
          return (
            <Card
              key={module.id}
              className="relative transition-shadow hover:shadow-md cursor-pointer"
              onClick={() => onNavigate(module.id)}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className={`rounded-lg bg-muted p-2 ${module.iconColor}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <button
                    type="button"
                    aria-label={`Expand ${module.title}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigate(module.id);
                    }}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <h3 className="font-semibold">{module.title}</h3>
                  {module.comingSoon && (
                    <Badge variant="secondary" className="text-[10px]">
                      Coming soon
                    </Badge>
                  )}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  {module.stats.map((stat) => (
                    <div key={stat.label}>
                      <p className="text-lg font-semibold leading-none">{stat.value}</p>
                      <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}