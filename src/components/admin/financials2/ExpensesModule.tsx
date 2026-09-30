"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Badge } from "../../ui/badge";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../ui/dialog";

// ---------------------------------------------------------------------------
// Financials 2 → Expenses (expanded view)
//
// The admin logs what was spent, month by month: date, category, amount and a
// short description. Shows the month's total, a per-category breakdown and the
// list of entries (edit / delete). Data: /api/finance/financials2/expenses.
// ---------------------------------------------------------------------------

interface ExpenseRow {
  id: string;
  date: string;
  amount: number;
  description: string | null;
  status: string;
  categoryId: string;
  categoryName: string;
  loggedByName: string | null;
}
interface PageData {
  month: string;
  summary: { total: number; count: number };
  byCategory: { categoryId: string; name: string; total: number; count: number }[];
  expenses: ExpenseRow[];
  categories: { id: string; name: string }[];
}

const NEW_CATEGORY = "__new__";

const usd = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);

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
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const todayYmd = () => new Date().toISOString().slice(0, 10);

/** Default date for a new expense: today if we're in the selected month, else its 1st. */
const defaultDateFor = (month: string) => (month === thisMonth() ? todayYmd() : `${month}-01`);

export function ExpensesModule() {
  const [month, setMonth] = useState(thisMonth());
  const [data, setData] = useState<PageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseRow | null>(null);
  const [deleting, setDeleting] = useState<ExpenseRow | null>(null);

  const load = useCallback(async (m: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/finance/financials2/expenses?month=${m}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message || "Failed to load expenses");
      setData(json as PageData);
    } catch (e: any) {
      setError(e.message || "Failed to load expenses");
    }
  }, []);

  useEffect(() => {
    setData(null);
    load(month);
  }, [month, load]);

  const isCurrent = month === thisMonth();
  const topShare = Math.max(1, data?.summary.total ?? 1);

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
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          disabled={!data}
        >
          <Plus className="h-4 w-4 mr-1" />
          Log expense
        </Button>
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
        <Summary label="Total expenses" value={data ? usd(data.summary.total) : "…"} sub={`Incurred in ${monthLabel(month)}`} strong />
        <Summary label="Entries" value={data ? String(data.summary.count) : "…"} sub="logged this month" />
        <Summary
          label="Biggest category"
          value={data ? data.byCategory[0]?.name ?? "—" : "…"}
          sub={data && data.byCategory[0] ? usd(data.byCategory[0].total) : ""}
        />
      </div>

      {/* By category */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">By category</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Entries</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="w-[35%] hidden md:table-cell" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.byCategory.map((c) => (
                <TableRow key={c.categoryId}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-right">{c.count}</TableCell>
                  <TableCell className="text-right font-semibold">{usd(c.total)}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-foreground/70" style={{ width: `${(c.total / topShare) * 100}%` }} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {data && data.byCategory.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                    Nothing logged for {monthLabel(month)} yet.
                  </TableCell>
                </TableRow>
              )}
              {!data && !error && (
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Entries */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Expenses in {monthLabel(month)}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Logged by</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.expenses.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{fmtDate(e.date)}</TableCell>
                    <TableCell>{e.categoryName}</TableCell>
                    <TableCell className="max-w-[22rem] truncate" title={e.description ?? ""}>
                      {e.description || "—"}
                      {e.status === "SUBMITTED" && (
                        <Badge variant="outline" className="ml-2 border-amber-200 bg-amber-100 text-amber-800">
                          Pending
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{e.loggedByName ?? "—"}</TableCell>
                    <TableCell className="text-right font-medium">{usd(e.amount)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Edit"
                        onClick={() => {
                          setEditing(e);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" title="Delete" onClick={() => setDeleting(e)}>
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {data && data.expenses.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      No expenses logged for {monthLabel(month)}.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {data && (
        <ExpenseFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          categories={data.categories}
          editing={editing}
          defaultDate={defaultDateFor(month)}
          onSaved={(savedMonth) => {
            if (savedMonth !== month) setMonth(savedMonth);
            else load(month);
          }}
        />
      )}

      <DeleteDialog
        expense={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={() => {
          setDeleting(null);
          load(month);
        }}
      />
    </div>
  );
}

function Summary({ label, value, sub, strong }: { label: string; value: string; sub?: string; strong?: boolean }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={`mt-1 ${strong ? "text-3xl" : "text-2xl"} font-semibold tracking-tight truncate`}>{value}</div>
        {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function ExpenseFormDialog({
  open,
  onOpenChange,
  categories,
  editing,
  defaultDate,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: { id: string; name: string }[];
  editing: ExpenseRow | null;
  defaultDate: string;
  onSaved: (month: string) => void;
}) {
  const [date, setDate] = useState(defaultDate);
  const [categoryId, setCategoryId] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNewCategory("");
    if (editing) {
      setDate(editing.date.slice(0, 10));
      setCategoryId(editing.categoryId);
      setAmount(String(editing.amount));
      setDescription(editing.description ?? "");
    } else {
      setDate(defaultDate);
      setCategoryId("");
      setAmount("");
      setDescription("");
    }
  }, [open, editing, defaultDate]);

  const submit = async () => {
    const amt = Number(amount);
    if (!description.trim()) return toast.error("Add a short description");
    if (!Number.isFinite(amt) || amt <= 0) return toast.error("Enter an amount greater than 0");
    if (!date) return toast.error("Choose the date");
    const usingNew = categoryId === NEW_CATEGORY;
    if (usingNew ? !newCategory.trim() : !categoryId) return toast.error("Choose a category");

    setSaving(true);
    try {
      const res = await fetch(
        editing ? `/api/finance/financials2/expenses/${editing.id}` : "/api/finance/financials2/expenses",
        {
          method: editing ? "PUT" : "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date,
            amount: amt,
            description,
            ...(usingNew ? { newCategoryName: newCategory } : { categoryId }),
          }),
        },
      );
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message || "Failed to save expense");
      toast.success(editing ? "Expense updated" : "Expense logged");
      onOpenChange(false);
      onSaved(date.slice(0, 7));
    } catch (e: any) {
      toast.error(e.message || "Failed to save expense");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit expense" : "Log expense"}</DialogTitle>
          <DialogDescription>Record something E8 spent. It counts toward the month of the date you pick.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input placeholder="e.g. Adobe Creative Cloud — annual plan" value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Amount (USD)</Label>
              <Input type="number" inputMode="decimal" min="0" step="0.01" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a category…" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
                <SelectItem value={NEW_CATEGORY}>+ New category…</SelectItem>
              </SelectContent>
            </Select>
            {categoryId === NEW_CATEGORY && (
              <Input autoFocus placeholder="New category name" value={newCategory} maxLength={60} onChange={(e) => setNewCategory(e.target.value)} />
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Saving…" : editing ? "Save changes" : "Log expense"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({
  expense,
  onClose,
  onDeleted,
}: {
  expense: ExpenseRow | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    if (!expense) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/finance/financials2/expenses/${expense.id}`, { method: "DELETE", credentials: "include" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message || "Failed to delete expense");
      toast.success("Expense deleted");
      onDeleted();
    } catch (e: any) {
      toast.error(e.message || "Failed to delete expense");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!expense} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete this expense?</DialogTitle>
          <DialogDescription>
            {expense ? `${usd(expense.amount)} — ${expense.description || expense.categoryName} will be removed from ${monthLabel(expense.date.slice(0, 7))}.` : ""}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={busy}>
            {busy ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
