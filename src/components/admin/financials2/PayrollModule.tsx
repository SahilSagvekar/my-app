"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent } from "../../ui/card";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "../../ui/table";

// ---------------------------------------------------------------------------
// Financials 2 → Payroll (expanded view)
//
// One row per employee for the selected month: Name, Role, Hourly Rate,
// Est. Monthly, the amount the admin enters, and a Paid / Unpaid dropdown.
// Changes save immediately (dropdown change, or amount on blur / Enter).
// Data: /api/finance/financials2/payroll (same Payroll table as the Finance tab).
// ---------------------------------------------------------------------------

interface EmployeeRow {
  employeeId: number;
  name: string;
  role: string | null;
  hourlyRate: number | null;
  estMonthly: number | null;
  status: "PENDING" | "PAID";
  amount: number | null;
}
interface PageData {
  month: string;
  employees: EmployeeRow[];
  totals: { employeeCount: number; paidCount: number; unpaidCount: number; paidTotal: number; estTotal: number };
}

const usd = (n: number | null | undefined) =>
  n === null || n === undefined
    ? "—"
    : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

const roleLabel = (role: string | null) =>
  !role
    ? "—"
    : role.toLowerCase() === "qc"
    ? "QC"
    : role
        .split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");

const monthLabel = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
};
const shiftMonth = (month: string, delta: number) => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};
const thisMonth = () => {
  const n = new Date();
  return `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, "0")}`;
};

export function PayrollModule() {
  const [month, setMonth] = useState(thisMonth());
  const [data, setData] = useState<PageData | null>(null);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<Record<number, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (m: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/finance/financials2/payroll?month=${m}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message || "Failed to load payroll");
      setData(json as PageData);
      setDrafts({});
    } catch (e: any) {
      setError(e.message || "Failed to load payroll");
    }
  }, []);

  useEffect(() => {
    setData(null);
    load(month);
  }, [month, load]);

  const save = async (row: EmployeeRow, changes: { status?: "PAID" | "PENDING"; amount?: string }) => {
    setSaving((s) => ({ ...s, [row.employeeId]: true }));
    try {
      const res = await fetch("/api/finance/financials2/payroll", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: row.employeeId, month, ...changes }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message || "Failed to save");
      await load(month);
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
      await load(month); // snap the row back to what's actually stored
    } finally {
      setSaving((s) => ({ ...s, [row.employeeId]: false }));
    }
  };

  const onStatusChange = (row: EmployeeRow, status: "PAID" | "PENDING") => {
    const draft = drafts[row.employeeId];
    const typed = draft !== undefined && draft !== "" ? draft : undefined;
    // Marking Paid with no amount entered yet pre-fills the estimated monthly figure.
    const amount =
      typed ?? (status === "PAID" && !row.amount && row.estMonthly ? String(row.estMonthly) : undefined);
    save(row, { status, ...(amount !== undefined ? { amount } : {}) });
  };

  const onAmountCommit = (row: EmployeeRow) => {
    const draft = drafts[row.employeeId];
    if (draft === undefined) return;
    if (draft.trim() === "" || Number(draft) === (row.amount ?? null)) {
      setDrafts((d) => {
        const { [row.employeeId]: _omit, ...rest } = d;
        return rest;
      });
      return;
    }
    save(row, { amount: draft });
  };

  const isCurrent = month === thisMonth();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[10rem] text-center text-sm font-semibold">{monthLabel(month)}</div>
          <Button variant="outline" size="sm" onClick={() => setMonth(shiftMonth(month, 1))} disabled={isCurrent} aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </Button>
          {!isCurrent && (
            <Button variant="ghost" size="sm" onClick={() => setMonth(thisMonth())}>
              Current month
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}{" "}
          <button className="underline" onClick={() => load(month)}>
            Retry
          </button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Summary label="Paid this month" value={data ? usd(data.totals.paidTotal) : "…"} sub={data ? `${data.totals.paidCount} of ${data.totals.employeeCount} employees` : ""} />
        <Summary label="Still unpaid" value={data ? String(data.totals.unpaidCount) : "…"} sub="employees" />
        <Summary label="Est. monthly total" value={data ? usd(data.totals.estTotal) : "…"} sub="hourly × hours/week × 4" />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Hourly Rate</TableHead>
                  <TableHead className="text-right">Est. Monthly</TableHead>
                  <TableHead className="w-44">Amount</TableHead>
                  <TableHead className="w-40">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.employees.map((row) => {
                  const busy = !!saving[row.employeeId];
                  const value = drafts[row.employeeId] ?? (row.amount !== null ? String(row.amount) : "");
                  return (
                    <TableRow key={row.employeeId}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell>{roleLabel(row.role)}</TableCell>
                      <TableCell className="text-right">{row.hourlyRate !== null ? usd(row.hourlyRate) : "—"}</TableCell>
                      <TableCell className="text-right">{usd(row.estMonthly)}</TableCell>
                      <TableCell>
                        <div className="relative">
                          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                          <Input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.01"
                            className="pl-6"
                            placeholder={row.estMonthly ? row.estMonthly.toFixed(2) : "0.00"}
                            value={value}
                            disabled={busy}
                            onChange={(e) => setDrafts((d) => ({ ...d, [row.employeeId]: e.target.value }))}
                            onBlur={() => onAmountCommit(row)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                            }}
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select value={row.status} onValueChange={(v) => onStatusChange(row, v as "PAID" | "PENDING")} disabled={busy}>
                          <SelectTrigger className={row.status === "PAID" ? "border-green-300 bg-green-50 text-green-800" : ""}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PAID">Paid</SelectItem>
                            <SelectItem value="PENDING">Unpaid</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {data && data.employees.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      No active employees found.
                    </TableCell>
                  </TableRow>
                )}
                {!data && !error && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      Loading…
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              {data && data.employees.length > 0 && (
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={3} className="font-semibold">
                      Total
                    </TableCell>
                    <TableCell className="text-right font-semibold">{usd(data.totals.estTotal)}</TableCell>
                    <TableCell className="font-semibold">{usd(data.totals.paidTotal)} paid</TableCell>
                    <TableCell className="font-semibold">{data.totals.paidCount} paid</TableCell>
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Summary({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
        {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}
