"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Plus, Ban, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Badge } from "../../ui/badge";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Textarea } from "../../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";

// ---------------------------------------------------------------------------
// Financials 2 → Client Payments (expanded view)
//
// • Revenue for the selected month = money RECEIVED that month: Stripe invoice
//   payments + manual payments (cash / check / Zelle / wire) an admin records.
// • Month-by-month revenue for the last 12 months (click a row to jump to it).
// • Invoices due in the selected month, with manual payments folded in.
// • Manual payments received in the selected month, with an Add / Void flow.
// Data: /api/finance/financials2/client-payments (amounts are cents).
// ---------------------------------------------------------------------------

interface MonthRow { month: string; stripeCents: number; manualCents: number; totalCents: number }
interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  clientName: string;
  description: string | null;
  status: string;
  amountCents: number;
  stripePaidCents: number;
  manualPaidCents: number;
  paidCents: number;
  dueDate: string | null;
  paidAt: string | null;
  createdAt: string;
  hostedUrl: string | null;
}
interface ManualRow {
  id: string;
  clientName: string;
  invoiceNumber: string | null;
  amountCents: number;
  method: string;
  receivedAt: string;
  reference: string | null;
  notes: string | null;
  createdByName: string | null;
  voidedAt: string | null;
  voidReason: string | null;
}
interface PageData {
  month: string;
  summary: { stripeCents: number; manualCents: number; totalCents: number; invoicedCents: number; outstandingCents: number };
  months: MonthRow[];
  invoices: InvoiceRow[];
  manualPayments: ManualRow[];
  clients: { id: string; name: string }[];
}
interface OpenInvoice { id: string; invoiceNumber: string; amountCents: number; balanceCents: number; dueDate: string | null }

const METHOD_LABELS: Record<string, string> = {
  CASH: "Cash",
  CHECK: "Check",
  ZELLE: "Zelle",
  WIRE: "Wire transfer",
  OTHER: "Other",
};

const STATUS_STYLES: Record<string, string> = {
  PAID: "bg-green-100 text-green-800 border-green-200",
  PARTIALLY_PAID: "bg-amber-100 text-amber-800 border-amber-200",
  OVERDUE: "bg-red-100 text-red-800 border-red-200",
  SENT: "bg-blue-100 text-blue-800 border-blue-200",
  PENDING: "bg-blue-100 text-blue-800 border-blue-200",
  CANCELED: "bg-gray-100 text-gray-600 border-gray-200",
  REFUNDED: "bg-gray-100 text-gray-600 border-gray-200",
};

const usd = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((cents || 0) / 100);

const monthLabel = (month: string, style: "long" | "short" = "long") => {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return month;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
    month: style,
    year: "numeric",
    timeZone: "UTC",
  });
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

const fmtDate = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
};

const todayYmd = () => new Date().toISOString().slice(0, 10);

export function ClientPaymentsModule() {
  const [month, setMonth] = useState<string>(thisMonth());
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [voidTarget, setVoidTarget] = useState<ManualRow | null>(null);

  const load = useCallback(async (m: string, opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/finance/financials2/client-payments?month=${m}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message || "Failed to load client payments");
      setData(json as PageData);
    } catch (e: any) {
      setError(e.message || "Failed to load client payments");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(month);
  }, [month, load]);

  const maxMonthTotal = Math.max(1, ...(data?.months.map((m) => m.totalCents) ?? [1]));
  const isCurrent = month === thisMonth();

  return (
    <div className="space-y-6">
      {/* Month selector + add button */}
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
        <Button onClick={() => setAddOpen(true)} disabled={!data}>
          <Plus className="h-4 w-4 mr-1" />
          Add manual payment
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

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Total revenue" value={data ? usd(data.summary.totalCents) : "…"} sub={`Received in ${monthLabel(month)}`} strong />
        <SummaryCard label="Stripe payments" value={data ? usd(data.summary.stripeCents) : "…"} sub="Card / ACH via invoices" />
        <SummaryCard label="Manual payments" value={data ? usd(data.summary.manualCents) : "…"} sub="Cash, check, Zelle, wire" />
        <SummaryCard
          label="Outstanding"
          value={data ? usd(data.summary.outstandingCents) : "…"}
          sub={data ? `of ${usd(data.summary.invoicedCents)} invoiced (due this month)` : ""}
        />
      </div>

      {/* Revenue by month */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Revenue by month</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Stripe</TableHead>
                  <TableHead className="text-right">Manual</TableHead>
                  <TableHead className="text-right">Total revenue</TableHead>
                  <TableHead className="w-[30%] hidden md:table-cell" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...(data?.months ?? [])].reverse().map((m) => (
                  <TableRow
                    key={m.month}
                    onClick={() => setMonth(m.month)}
                    className={`cursor-pointer ${m.month === month ? "bg-muted" : ""}`}
                  >
                    <TableCell className="font-medium">{monthLabel(m.month, "short")}</TableCell>
                    <TableCell className="text-right">{usd(m.stripeCents)}</TableCell>
                    <TableCell className="text-right">{usd(m.manualCents)}</TableCell>
                    <TableCell className="text-right font-semibold">{usd(m.totalCents)}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-foreground/70" style={{ width: `${(m.totalCents / maxMonthTotal) * 100}%` }} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!data && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Loading…
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Invoices */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Invoices due in {monthLabel(month)}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.invoices.map((inv) => {
                  const balance = ["CANCELED", "REFUNDED"].includes(inv.status) ? 0 : Math.max(0, inv.amountCents - inv.paidCents);
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">
                        {inv.hostedUrl ? (
                          <a href={inv.hostedUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">
                            {inv.invoiceNumber}
                            <ExternalLink className="h-3 w-3 text-muted-foreground" />
                          </a>
                        ) : (
                          inv.invoiceNumber
                        )}
                      </TableCell>
                      <TableCell>{inv.clientName}</TableCell>
                      <TableCell>{fmtDate(inv.dueDate ?? inv.createdAt)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_STYLES[inv.status] ?? ""}>
                          {inv.status.replace("_", " ")}
                        </Badge>
                        {inv.manualPaidCents > 0 && <span className="ml-2 text-xs text-muted-foreground">incl. manual</span>}
                      </TableCell>
                      <TableCell className="text-right">{usd(inv.amountCents)}</TableCell>
                      <TableCell className="text-right">{usd(inv.paidCents)}</TableCell>
                      <TableCell className="text-right font-medium">{usd(balance)}</TableCell>
                    </TableRow>
                  );
                })}
                {data && data.invoices.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No invoices due in {monthLabel(month)}.
                    </TableCell>
                  </TableRow>
                )}
                {!data && loading && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Loading…
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Manual payments */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Manual payments received in {monthLabel(month)}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Received</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Reference / notes</TableHead>
                  <TableHead>Added by</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.manualPayments.map((p) => {
                  const voided = !!p.voidedAt;
                  return (
                    <TableRow key={p.id} className={voided ? "text-muted-foreground" : ""}>
                      <TableCell className={voided ? "line-through" : ""}>{fmtDate(p.receivedAt)}</TableCell>
                      <TableCell>{p.clientName}</TableCell>
                      <TableCell>{METHOD_LABELS[p.method] ?? p.method}</TableCell>
                      <TableCell>{p.invoiceNumber ?? "—"}</TableCell>
                      <TableCell className="max-w-[16rem] truncate" title={[p.reference, p.notes].filter(Boolean).join(" — ")}>
                        {[p.reference, p.notes].filter(Boolean).join(" — ") || "—"}
                        {voided && <span className="ml-2 text-xs text-red-600">Voided{p.voidReason ? `: ${p.voidReason}` : ""}</span>}
                      </TableCell>
                      <TableCell>{p.createdByName ?? "—"}</TableCell>
                      <TableCell className={`text-right font-medium ${voided ? "line-through" : ""}`}>{usd(p.amountCents)}</TableCell>
                      <TableCell>
                        {!voided && (
                          <Button variant="ghost" size="sm" title="Void this payment" onClick={() => setVoidTarget(p)}>
                            <Ban className="h-4 w-4 text-red-600" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {data && data.manualPayments.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No manual payments recorded for {monthLabel(month)}.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {data && (
        <AddManualPaymentDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          clients={data.clients}
          onSaved={(receivedMonth) => {
            // If the payment landed in a different month, jump there so the
            // admin sees it straight away.
            if (receivedMonth !== month) setMonth(receivedMonth);
            else load(month, { silent: true });
          }}
        />
      )}

      <VoidDialog
        payment={voidTarget}
        onClose={() => setVoidTarget(null)}
        onVoided={() => {
          setVoidTarget(null);
          load(month, { silent: true });
        }}
      />
    </div>
  );
}

function SummaryCard({ label, value, sub, strong }: { label: string; value: string; sub?: string; strong?: boolean }) {
  return (
    <Card>
      <CardContent className="p-5 text-center">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={`mt-1 ${strong ? "text-3xl" : "text-2xl"} font-semibold tracking-tight`}>{value}</div>
        {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function AddManualPaymentDialog({
  open,
  onOpenChange,
  clients,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: { id: string; name: string }[];
  onSaved: (receivedMonth: string) => void;
}) {
  const [clientId, setClientId] = useState("");
  const [invoiceId, setInvoiceId] = useState("none");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("CASH");
  const [receivedAt, setReceivedAt] = useState(todayYmd());
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [openInvoices, setOpenInvoices] = useState<OpenInvoice[]>([]);
  const [saving, setSaving] = useState(false);

  // Reset whenever the dialog opens.
  useEffect(() => {
    if (open) {
      setClientId("");
      setInvoiceId("none");
      setAmount("");
      setMethod("CASH");
      setReceivedAt(todayYmd());
      setReference("");
      setNotes("");
      setOpenInvoices([]);
    }
  }, [open]);

  // Load the chosen client's unpaid invoices for the optional picker.
  useEffect(() => {
    if (!clientId) {
      setOpenInvoices([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/finance/financials2/client-payments/open-invoices?clientId=${encodeURIComponent(clientId)}`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled && json.ok) setOpenInvoices(json.invoices as OpenInvoice[]);
      })
      .catch(() => {});
    setInvoiceId("none");
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const selectedInvoice = openInvoices.find((i) => i.id === invoiceId);

  const submit = async () => {
    if (!clientId) return toast.error("Choose a client");
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return toast.error("Enter an amount greater than 0");
    if (!receivedAt) return toast.error("Choose the date received");

    setSaving(true);
    try {
      const res = await fetch("/api/finance/financials2/client-payments/manual", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          invoiceId: invoiceId === "none" ? undefined : invoiceId,
          amount: amt,
          method,
          receivedAt,
          reference,
          notes,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message || "Failed to save payment");
      toast.success("Payment recorded");
      onOpenChange(false);
      onSaved(receivedAt.slice(0, 7));
    } catch (e: any) {
      toast.error(e.message || "Failed to save payment");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add manual payment</DialogTitle>
          <DialogDescription>
            Record money received outside Stripe. It counts toward revenue in the month it was received.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Client</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a client…" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Apply to invoice (optional)</Label>
            <Select value={invoiceId} onValueChange={(v) => { setInvoiceId(v); const inv = openInvoices.find((i) => i.id === v); if (inv) setAmount((inv.balanceCents / 100).toFixed(2)); }} disabled={!clientId}>
              <SelectTrigger>
                <SelectValue placeholder="No invoice" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not linked to an invoice</SelectItem>
                {openInvoices.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.invoiceNumber} — {usd(i.balanceCents)} due
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {clientId && openInvoices.length === 0 && (
              <p className="text-xs text-muted-foreground">This client has no unpaid invoices.</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Amount (USD)</Label>
              <Input type="number" inputMode="decimal" min="0" step="0.01" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
              {selectedInvoice && (
                <p className="text-xs text-muted-foreground">Invoice balance: {usd(selectedInvoice.balanceCents)}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(METHOD_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Date received</Label>
              <Input type="date" value={receivedAt} max={todayYmd()} onChange={(e) => setReceivedAt(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Reference (optional)</Label>
              <Input placeholder="Check # / confirmation" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={200} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Saving…" : "Record payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VoidDialog({
  payment,
  onClose,
  onVoided,
}: {
  payment: ManualRow | null;
  onClose: () => void;
  onVoided: () => void;
}) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (payment) setReason("");
  }, [payment]);

  const confirm = async () => {
    if (!payment) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/finance/financials2/client-payments/manual/${payment.id}/void`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message || "Failed to void payment");
      toast.success("Payment voided");
      onVoided();
    } catch (e: any) {
      toast.error(e.message || "Failed to void payment");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!payment} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Void this payment?</DialogTitle>
          <DialogDescription>
            {payment ? `${usd(payment.amountCents)} from ${payment.clientName} will be removed from revenue. It stays listed as voided for the record.` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>Reason (optional)</Label>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="e.g. entered twice" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={saving}>
            {saving ? "Voiding…" : "Void payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
