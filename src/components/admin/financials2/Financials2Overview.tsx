"use client";

import { Card, CardContent } from "../../ui/card";
import { Badge } from "../../ui/badge";
import {
  Landmark,
  Receipt,
  Users,
  Wallet,
  FileSpreadsheet,
  LineChart,
  Maximize2,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Financials 2 — card-grid overview
//
// One card per module (Ledger, Client Payments, Contractors, Payroll,
// Expenses, Reports/KPIs). Each card shows a couple of key stats and an
// expand icon that hands off to its own full-page view via onNavigate,
// following the same onPageChange page-switch pattern used everywhere else
// in AdminDashboard.
//
// Stats are wired to "—" placeholders until each module's backend/API lands
// (see Financial Tracker — Architecture Plan, §10 build sequence) — this
// component intentionally doesn't fabricate numbers before there's real data
// behind them.
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

const MODULE_CARDS: ModuleCard[] = [
  {
    id: "financials2-ledger",
    title: "Ledger",
    icon: Landmark,
    iconColor: "text-blue-600",
    stats: [
      { label: "Money in", value: "—" },
      { label: "Money out", value: "—" },
    ],
    comingSoon: true,
  },
  {
    id: "financials2-client-payments",
    title: "Client Payments",
    icon: FileSpreadsheet,
    iconColor: "text-green-600",
    stats: [
      { label: "Outstanding", value: "—" },
      { label: "Overdue", value: "—" },
    ],
    comingSoon: true,
  },
  {
    id: "financials2-contractors",
    title: "Contractors",
    icon: Users,
    iconColor: "text-purple-600",
    stats: [
      { label: "Active", value: "—" },
      { label: "W-9 pending", value: "—" },
    ],
    comingSoon: true,
  },
  {
    id: "financials2-payroll",
    title: "Payroll",
    icon: Wallet,
    iconColor: "text-orange-600",
    stats: [
      { label: "This month", value: "—" },
      { label: "Next run", value: "—" },
    ],
    comingSoon: true,
  },
  {
    id: "financials2-expenses",
    title: "Expenses",
    icon: Receipt,
    iconColor: "text-red-600",
    stats: [
      { label: "Pending approval", value: "—" },
      { label: "Reimbursed (mo.)", value: "—" },
    ],
  },
  {
    id: "financials2-reports",
    title: "Reports & KPIs",
    icon: LineChart,
    iconColor: "text-teal-600",
    stats: [
      { label: "Profit margin", value: "—" },
      { label: "Revenue vs goal", value: "—" },
    ],
    comingSoon: true,
  },
];

export function Financials2Overview({ onNavigate }: Financials2OverviewProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {MODULE_CARDS.map((module) => {
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
  );
}