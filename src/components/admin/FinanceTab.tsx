"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Calendar } from "../ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import {
  DollarSign,
  Users,
  Plus,
  Search,
  Clock,
  AlertCircle,
  Calendar as CalendarIcon,
  Eye,
  Trash2,
  Loader2,
  TrendingUp,
  CreditCard,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  XCircle,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "../ui/sonner";

// ---------- Types ----------

interface RealInvoice {
  id: string;
  invoiceNumber: string;
  status: string; // DRAFT | SENT | PAID | OVERDUE | CANCELLED | VOID
  amount: number; // cents
  amountPaid: number; // cents
  currency: string;
  dueDate?: string;
  paidAt?: string;
  sentAt?: string;
  createdAt: string;
  description?: string;
  stripeHostedInvoiceUrl?: string;
  stripePdfUrl?: string;
  clientName?: string;
  clientId?: string;
  isRecurring: boolean;
}

interface RealSubscription {
  id: string;
  status: string; // ACTIVE | CANCELED | PAST_DUE | TRIALING
  amount: number; // cents
  currency: string;
  interval: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  canceledAt?: string;
  clientName?: string;
  clientId?: string;
  stripeSubscriptionId: string;
}

interface Employee {
  id: number;
  name: string;
  email: string;
  role: string;
  hourlyRate: number;
  hoursPerWeek: number;
  monthlyRate: number;
  hireDate: string;
  status: "active" | "inactive" | "terminated";
  avatar: string;
  worksOnSaturday: boolean;
}

interface PayrollRecord {
  id: number;
  employeeId: number;
  employeeName: string;
  month: number;
  year: number;
  baseSalary: number;
  bonuses: number;
  deductions: number;
  netPay: number;
  status: "pending" | "paid";
  payDate?: string;
}

// ---------- Helpers ----------

const centsToDisplay = (cents: number, currency = "usd") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format((cents || 0) / 100);

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount || 0);

const formatDate = (dateString?: string) => {
  if (!dateString) return "—";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" });
};

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatMonthRange(month: number, year: number) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
  return `${start.toLocaleDateString("en-US", opts)} – ${end.toLocaleDateString("en-US", opts)}`;
}

const invoiceStatusColor = (status: string) => {
  switch (status?.toUpperCase()) {
    case "PAID": return "bg-green-100 text-green-800";
    case "SENT": return "bg-blue-100 text-blue-800";
    case "OVERDUE": return "bg-red-100 text-red-800";
    case "DRAFT": return "bg-gray-100 text-gray-800";
    case "VOID":
    case "CANCELLED": return "bg-orange-100 text-orange-800";
    default: return "bg-gray-100 text-gray-800";
  }
};

const subscriptionStatusColor = (status: string) => {
  switch (status?.toUpperCase()) {
    case "ACTIVE": return "bg-green-100 text-green-800";
    case "TRIALING": return "bg-blue-100 text-blue-800";
    case "PAST_DUE": return "bg-red-100 text-red-800";
    case "CANCELED": return "bg-gray-100 text-gray-800";
    default: return "bg-gray-100 text-gray-800";
  }
};

const payrollStatusColor = (status: string) => {
  switch (status) {
    case "paid": return "bg-green-100 text-green-800";
    case "pending": return "bg-yellow-100 text-yellow-800";
    default: return "bg-gray-100 text-gray-800";
  }
};

const DEFAULT_WORKING_DAYS = 22;

async function apiFetch(path: string, options: RequestInit = {}) {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  let data;
  try { data = await res.json(); } catch { data = null; }
  if (!res.ok) throw new Error((data && data.message) || "Request failed");
  return data;
}

// ---------- Component ----------

export function FinanceTab() {
  // Real billing state
  const [invoices, setInvoices] = useState<RealInvoice[]>([]);
  const [subscriptions, setSubscriptions] = useState<RealSubscription[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [loadingSubscriptions, setLoadingSubscriptions] = useState(false);

  // Payroll + employees (existing backend)
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payroll, setPayroll] = useState<PayrollRecord[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [loadingPayroll, setLoadingPayroll] = useState(false);

  // UI state
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState("all");
  const [showNewInvoiceDialog, setShowNewInvoiceDialog] = useState(false);
  const [showPayrollDialog, setShowPayrollDialog] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<RealInvoice | null>(null);

  // Bonus/hourly modals
  const [bonusModalOpen, setBonusModalOpen] = useState(false);
  const [hourlyModalOpen, setHourlyModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [bonusAmount, setBonusAmount] = useState("");
  const [hourlyRateInput, setHourlyRateInput] = useState("");

  // Payroll form
  const [newPayroll, setNewPayroll] = useState({ month: "", year: new Date().getFullYear() });
  const [payrollYearFilter, setPayrollYearFilter] = useState("all");
  const [payrollMonthFilter, setPayrollMonthFilter] = useState("all");
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [hidingPayrollId, setHidingPayrollId] = useState<number | null>(null);
  const [isGeneratingPayroll, setIsGeneratingPayroll] = useState(false);

  // New invoice form
  const [newInvoice, setNewInvoice] = useState({
    clientId: "",
    description: "",
    amount: "",
    dueDate: undefined as Date | undefined,
  });

  // ---------- Fetches ----------

  const loadInvoices = useCallback(async () => {
    try {
      setLoadingInvoices(true);
      const params = new URLSearchParams({ limit: "100" });
      if (invoiceStatusFilter !== "all") params.append("status", invoiceStatusFilter.toUpperCase());
      const data = await apiFetch(`/api/billing/invoices?${params}`);
      const mapped: RealInvoice[] = (data?.invoices || []).map((inv: any) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        status: inv.status,
        amount: inv.amount,
        amountPaid: inv.amountPaid || 0,
        currency: inv.currency || "usd",
        dueDate: inv.dueDate,
        paidAt: inv.paidAt,
        sentAt: inv.sentAt,
        createdAt: inv.createdAt,
        description: inv.description,
        stripeHostedInvoiceUrl: inv.stripeHostedInvoiceUrl,
        stripePdfUrl: inv.stripePdfUrl,
        clientName: inv.stripeCustomer?.client?.name || inv.stripeCustomer?.client?.companyName || "—",
        clientId: inv.stripeCustomer?.clientId,
        isRecurring: inv.isRecurring || false,
      }));
      setInvoices(mapped);
    } catch (err: any) {
      toast("Error loading invoices", { description: err.message });
    } finally {
      setLoadingInvoices(false);
    }
  }, [invoiceStatusFilter]);

  const loadSubscriptions = useCallback(async () => {
    try {
      setLoadingSubscriptions(true);
      const data = await apiFetch("/api/billing/subscriptions");
      const mapped: RealSubscription[] = (data?.subscriptions || []).map((sub: any) => ({
        id: sub.id,
        status: sub.status,
        amount: sub.amount,
        currency: sub.currency || "usd",
        interval: sub.interval || "month",
        currentPeriodStart: sub.currentPeriodStart,
        currentPeriodEnd: sub.currentPeriodEnd,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
        canceledAt: sub.canceledAt,
        clientName: sub.stripeCustomer?.client?.name || sub.stripeCustomer?.client?.companyName || "—",
        clientId: sub.stripeCustomer?.clientId,
        stripeSubscriptionId: sub.stripeSubscriptionId,
      }));
      setSubscriptions(mapped);
    } catch (err: any) {
      toast("Error loading subscriptions", { description: err.message });
    } finally {
      setLoadingSubscriptions(false);
    }
  }, []);

  const loadEmployees = useCallback(async () => {
    try {
      setLoadingEmployees(true);
      const data = await apiFetch("/api/employee/list");
      const mapped: Employee[] = (data?.employees || []).map((u: any) => {
        const name = u.name || u.email || "Unnamed";
        const avatar = name.split(" ").map((n: string) => n[0]).join("").toUpperCase() || "U";
        const hourly = u.hourlyRate ? Number(u.hourlyRate) : 0;
        const hoursPerWeek = u.hoursPerWeek ? Number(u.hoursPerWeek) : 40;
        return {
          id: u.id,
          name,
          email: u.email,
          role: u.role,
          hourlyRate: hourly,
          hoursPerWeek,
          monthlyRate: hourly * hoursPerWeek * 4,
          hireDate: u.joinedAt || u.createdAt,
          status: u.employeeStatus === "ACTIVE" ? "active" : u.employeeStatus === "TERMINATED" ? "terminated" : "inactive",
          avatar,
          worksOnSaturday: !!u.worksOnSaturday,
        };
      });
      setEmployees(mapped);
    } catch (err: any) {
      toast("Error loading employees", { description: err.message });
    } finally {
      setLoadingEmployees(false);
    }
  }, []);

  const loadPayroll = useCallback(async () => {
    try {
      setLoadingPayroll(true);
      const params = new URLSearchParams();
      if (payrollYearFilter !== "all") params.append("year", payrollYearFilter);
      if (payrollMonthFilter !== "all") params.append("month", payrollMonthFilter);
      const data = await apiFetch(`/api/payroll/list${params.toString() ? `?${params}` : ""}`);
      const mapped: PayrollRecord[] = (data?.payrolls || []).map((p: any) => {
        const d = p.periodStart ? new Date(p.periodStart) : null;
        return {
          id: p.id,
          employeeId: p.employeeId,
          employeeName: p.employee?.name || `Employee #${p.employeeId}`,
          month: d ? d.getUTCMonth() + 1 : 0,
          year: d ? d.getUTCFullYear() : 0,
          baseSalary: Number(p.baseSalary),
          bonuses: Number(p.totalBonuses),
          deductions: Number(p.totalDeductions),
          netPay: Number(p.netPay),
          status: p.status === "PAID" ? "paid" : "pending",
          payDate: p.paidAt,
        };
      });
      setPayroll(mapped);
      if (data?.availableYears) setAvailableYears(data.availableYears);
    } catch (err: any) {
      toast("Error loading payroll", { description: err.message });
    } finally {
      setLoadingPayroll(false);
    }
  }, [payrollYearFilter, payrollMonthFilter]);

  useEffect(() => { loadInvoices(); }, [loadInvoices]);
  useEffect(() => { loadSubscriptions(); }, [loadSubscriptions]);
  useEffect(() => { loadEmployees(); loadPayroll(); }, [loadEmployees, loadPayroll]);

  // ---------- Derived stats ----------

  const paidInvoicesTotal = invoices
    .filter(i => i.status === "PAID")
    .reduce((s, i) => s + i.amount, 0);

  const pendingInvoicesTotal = invoices
    .filter(i => ["SENT", "DRAFT"].includes(i.status))
    .reduce((s, i) => s + i.amount, 0);

  const overdueTotal = invoices
    .filter(i => i.status === "OVERDUE")
    .reduce((s, i) => s + i.amount, 0);

  const activeSubsMonthly = subscriptions
    .filter(s => s.status === "ACTIVE" || s.status === "TRIALING")
    .reduce((sum, s) => sum + (s.interval === "year" ? s.amount / 12 : s.amount), 0);

  const monthlyPayrollCost = payroll.reduce((s, p) => s + (p.netPay || 0), 0);

  const filteredInvoices = invoices.filter(inv => {
    const matchSearch =
      inv.clientName?.toLowerCase().includes(invoiceSearch.toLowerCase()) ||
      inv.invoiceNumber.toLowerCase().includes(invoiceSearch.toLowerCase());
    const matchStatus = invoiceStatusFilter === "all" || inv.status === invoiceStatusFilter.toUpperCase();
    return matchSearch && matchStatus;
  });

  // ---------- Handlers ----------

  const handleCreateInvoice = async () => {
    if (!newInvoice.clientId || !newInvoice.amount) {
      toast("Fill in client and amount");
      return;
    }
    try {
      await apiFetch("/api/billing/invoices", {
        method: "POST",
        body: JSON.stringify({
          clientId: newInvoice.clientId,
          description: newInvoice.description,
          amount: Math.round(parseFloat(newInvoice.amount) * 100),
          dueDate: newInvoice.dueDate?.toISOString(),
          lineItems: [{ description: newInvoice.description || "Services", amount: Math.round(parseFloat(newInvoice.amount) * 100), quantity: 1 }],
        }),
      });
      toast("✅ Invoice created");
      setShowNewInvoiceDialog(false);
      setNewInvoice({ clientId: "", description: "", amount: "", dueDate: undefined });
      loadInvoices();
    } catch (err: any) {
      toast("❌ Error", { description: err.message });
    }
  };

  const handleProcessPayroll = async () => {
    if (!newPayroll.month || !newPayroll.year) {
      toast("Select month and year");
      return;
    }
    const monthIndex = monthNames.indexOf(newPayroll.month);
    if (monthIndex === -1) { toast("Invalid month"); return; }
    try {
      setIsGeneratingPayroll(true);
      await apiFetch(`/api/payroll/generate/${newPayroll.year}/${monthIndex + 1}`, { method: "POST" });
      toast("✅ Payroll generated");
      setNewPayroll({ month: "", year: new Date().getFullYear() });
      setShowPayrollDialog(false);
      loadPayroll();
    } catch (err: any) {
      toast("❌ Error", { description: err.message });
    } finally {
      setIsGeneratingPayroll(false);
    }
  };

  const handleMarkPayrollPaid = async (record: PayrollRecord) => {
    try {
      await apiFetch(`/api/payroll/${record.id}/mark-paid`, { method: "PATCH" });
      toast("✅ Marked as paid");
      loadPayroll();
    } catch (err: any) {
      toast("❌ Error", { description: err.message });
    }
  };

  const handleHidePayroll = async (record: PayrollRecord) => {
    setHidingPayrollId(record.id);
    try {
      await apiFetch(`/api/payroll/${record.id}/hide`, { method: "PATCH", body: JSON.stringify({ hidden: true }) });
      toast("✅ Record hidden");
      loadPayroll();
    } catch (err: any) {
      toast("❌ Error", { description: err.message });
    } finally {
      setHidingPayrollId(null);
    }
  };

  const handleSaveBonus = async () => {
    if (!selectedEmployee) return;
    const value = parseFloat(bonusAmount);
    if (!value || value <= 0) { toast("Invalid bonus amount"); return; }
    try {
      await apiFetch(`/api/employee/${selectedEmployee.id}/bonus`, {
        method: "POST",
        body: JSON.stringify({ amount: value }),
      });
      toast("✅ Bonus added", { description: `${formatCurrency(value)} added to ${selectedEmployee.name}` });
      setBonusModalOpen(false);
      setBonusAmount("");
    } catch (err: any) {
      toast("❌ Error", { description: err.message });
    }
  };

  const handleSaveHourlyRate = async () => {
    if (!selectedEmployee) return;
    const value = parseFloat(hourlyRateInput);
    if (!value || value <= 0) { toast("Invalid hourly rate"); return; }
    try {
      await apiFetch(`/api/employee/${selectedEmployee.id}`, {
        method: "PATCH",
        body: JSON.stringify({ hourlyRate: value }),
      });
      toast("✅ Rate updated", { description: `${selectedEmployee.name}'s rate set to ${formatCurrency(value)}/hr` });
      setHourlyModalOpen(false);
      setHourlyRateInput("");
      loadEmployees();
    } catch (err: any) {
      toast("❌ Error", { description: err.message });
    }
  };

  // ---------- Render ----------

  return (
    <>
      <div className="space-y-6">

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-5">
              <p className="text-xs text-muted-foreground mb-1">Collected Revenue</p>
              <p className="text-xl font-semibold text-green-600">{centsToDisplay(paidInvoicesTotal)}</p>
              <div className="flex items-center gap-1 mt-1">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                <p className="text-xs text-muted-foreground">{invoices.filter(i => i.status === "PAID").length} paid invoices</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <p className="text-xs text-muted-foreground mb-1">Pending</p>
              <p className="text-xl font-semibold text-blue-600">{centsToDisplay(pendingInvoicesTotal)}</p>
              <div className="flex items-center gap-1 mt-1">
                <Clock className="h-3 w-3 text-blue-500" />
                <p className="text-xs text-muted-foreground">{invoices.filter(i => ["SENT","DRAFT"].includes(i.status)).length} outstanding</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <p className="text-xs text-muted-foreground mb-1">Overdue</p>
              <p className="text-xl font-semibold text-red-600">{centsToDisplay(overdueTotal)}</p>
              <div className="flex items-center gap-1 mt-1">
                <AlertCircle className="h-3 w-3 text-red-500" />
                <p className="text-xs text-muted-foreground">{invoices.filter(i => i.status === "OVERDUE").length} overdue</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <p className="text-xs text-muted-foreground mb-1">MRR (Subscriptions)</p>
              <p className="text-xl font-semibold text-purple-600">{centsToDisplay(activeSubsMonthly)}</p>
              <div className="flex items-center gap-1 mt-1">
                <TrendingUp className="h-3 w-3 text-purple-500" />
                <p className="text-xs text-muted-foreground">{subscriptions.filter(s => s.status === "ACTIVE").length} active</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <p className="text-xs text-muted-foreground mb-1">Monthly Payroll</p>
              <p className="text-xl font-semibold text-orange-600">{formatCurrency(monthlyPayrollCost)}</p>
              <div className="flex items-center gap-1 mt-1">
                <Users className="h-3 w-3 text-orange-500" />
                <p className="text-xs text-muted-foreground">{employees.filter(e => e.status === "active").length} active staff</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="invoices" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
            <TabsTrigger value="payroll">Payroll</TabsTrigger>
          </TabsList>

          {/* ── INVOICES TAB ── */}
          <TabsContent value="invoices" className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search invoices..."
                    value={invoiceSearch}
                    onChange={e => setInvoiceSearch(e.target.value)}
                    className="pl-10 w-64"
                  />
                </div>
                <Select value={invoiceStatusFilter} onValueChange={setInvoiceStatusFilter}>
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="SENT">Sent</SelectItem>
                    <SelectItem value="PAID">Paid</SelectItem>
                    <SelectItem value="OVERDUE">Overdue</SelectItem>
                    <SelectItem value="VOID">Void</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={loadInvoices} disabled={loadingInvoices}>
                  <RefreshCw className={`h-4 w-4 ${loadingInvoices ? "animate-spin" : ""}`} />
                </Button>
              </div>
              <Dialog open={showNewInvoiceDialog} onOpenChange={setShowNewInvoiceDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    New Invoice
                  </Button>
                </DialogTrigger>
                <DialogContent aria-describedby="new-invoice-desc">
                  <DialogHeader>
                    <DialogTitle>Create Invoice</DialogTitle>
                    <DialogDescription id="new-invoice-desc">Create a new invoice for a client.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Client ID</label>
                      <Input
                        value={newInvoice.clientId}
                        onChange={e => setNewInvoice(p => ({ ...p, clientId: e.target.value }))}
                        placeholder="e.g. clxxx..."
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Description</label>
                      <Input
                        value={newInvoice.description}
                        onChange={e => setNewInvoice(p => ({ ...p, description: e.target.value }))}
                        placeholder="Monthly production services"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Amount ($)</label>
                      <Input
                        type="number"
                        value={newInvoice.amount}
                        onChange={e => setNewInvoice(p => ({ ...p, amount: e.target.value }))}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Due Date</label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {newInvoice.dueDate ? newInvoice.dueDate.toLocaleDateString() : "Pick a date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={newInvoice.dueDate}
                            onSelect={date => setNewInvoice(p => ({ ...p, dueDate: date ?? undefined }))}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setShowNewInvoiceDialog(false)}>Cancel</Button>
                      <Button onClick={handleCreateInvoice}>Create</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {loadingInvoices ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading invoices...
              </div>
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Due</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No invoices found
                        </TableCell>
                      </TableRow>
                    ) : filteredInvoices.map(inv => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-mono text-sm">{inv.invoiceNumber}</TableCell>
                        <TableCell className="font-medium">{inv.clientName}</TableCell>
                        <TableCell>{centsToDisplay(inv.amount, inv.currency)}</TableCell>
                        <TableCell className={inv.status === "OVERDUE" ? "text-red-600 font-medium" : ""}>
                          {formatDate(inv.dueDate)}
                        </TableCell>
                        <TableCell>
                          <Badge className={invoiceStatusColor(inv.status)}>
                            {inv.status.toLowerCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {inv.isRecurring ? (
                            <Badge variant="outline" className="text-xs">Recurring</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">One-off</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setSelectedInvoice(inv)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {inv.stripeHostedInvoiceUrl && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => window.open(inv.stripeHostedInvoiceUrl, "_blank")}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            )}
                            {inv.stripePdfUrl && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => window.open(inv.stripePdfUrl, "_blank")}
                              >
                                <FileText className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>

          {/* ── SUBSCRIPTIONS TAB ── */}
          <TabsContent value="subscriptions" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                {subscriptions.filter(s => s.status === "ACTIVE").length} active subscriptions ·{" "}
                MRR: <span className="font-medium text-foreground">{centsToDisplay(activeSubsMonthly)}</span>
              </p>
              <Button variant="outline" size="sm" onClick={loadSubscriptions} disabled={loadingSubscriptions}>
                <RefreshCw className={`h-4 w-4 ${loadingSubscriptions ? "animate-spin" : ""}`} />
              </Button>
            </div>

            {loadingSubscriptions ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading subscriptions...
              </div>
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Interval</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Current Period</TableHead>
                      <TableHead>Renewal</TableHead>
                      <TableHead>Cancels</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subscriptions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No subscriptions found
                        </TableCell>
                      </TableRow>
                    ) : subscriptions.map(sub => (
                      <TableRow key={sub.id}>
                        <TableCell className="font-medium">{sub.clientName}</TableCell>
                        <TableCell>{centsToDisplay(sub.amount, sub.currency)}</TableCell>
                        <TableCell className="capitalize">{sub.interval}</TableCell>
                        <TableCell>
                          <Badge className={subscriptionStatusColor(sub.status)}>
                            {sub.status.toLowerCase().replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(sub.currentPeriodStart)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDate(sub.currentPeriodEnd)}
                        </TableCell>
                        <TableCell>
                          {sub.cancelAtPeriodEnd ? (
                            <Badge variant="outline" className="text-orange-600 border-orange-300 text-xs">
                              Cancels {formatDate(sub.currentPeriodEnd)}
                            </Badge>
                          ) : sub.canceledAt ? (
                            <Badge variant="outline" className="text-red-600 text-xs">
                              Cancelled
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>

          {/* ── PAYROLL TAB ── */}
          <TabsContent value="payroll" className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">
                  Generate and track payroll based on hourly rates, bonuses, and leave deductions
                </p>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <Select value={payrollYearFilter} onValueChange={setPayrollYearFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Years</SelectItem>
                    {availableYears.map(y => (
                      <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={payrollMonthFilter} onValueChange={setPayrollMonthFilter}>
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Months</SelectItem>
                    {monthNames.map((m, i) => (
                      <SelectItem key={m} value={(i + 1).toString()}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Dialog open={showPayrollDialog} onOpenChange={setShowPayrollDialog}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Generate Payroll
                    </Button>
                  </DialogTrigger>
                  <DialogContent aria-describedby="payroll-desc">
                    <DialogHeader>
                      <DialogTitle>Generate Monthly Payroll</DialogTitle>
                      <DialogDescription id="payroll-desc">
                        Generates payroll for all active employees for the selected month.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium">Month</label>
                          <Select value={newPayroll.month} onValueChange={v => setNewPayroll(p => ({ ...p, month: v }))}>
                            <SelectTrigger><SelectValue placeholder="Select month" /></SelectTrigger>
                            <SelectContent>
                              {monthNames.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-sm font-medium">Year</label>
                          <Input
                            type="number"
                            value={newPayroll.year}
                            onChange={e => setNewPayroll(p => ({ ...p, year: parseInt(e.target.value) || p.year }))}
                          />
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground bg-muted p-3 rounded-md space-y-1">
                        <p>Backend calculates:</p>
                        <ul className="list-disc ml-4 space-y-0.5">
                          <li>Base salary = hourly × working days × 8h</li>
                          <li>Sum of bonuses for the month</li>
                          <li>Leave-based deductions</li>
                        </ul>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setShowPayrollDialog(false)} disabled={isGeneratingPayroll}>
                          Cancel
                        </Button>
                        <Button onClick={handleProcessPayroll} disabled={isGeneratingPayroll || !newPayroll.month}>
                          {isGeneratingPayroll ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Generating...</> : "Generate"}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Employee quick actions */}
            {employees.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Staff — Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Hourly Rate</TableHead>
                        <TableHead>Est. Monthly</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employees.map(emp => (
                        <TableRow key={emp.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarFallback className="text-xs">{emp.avatar}</AvatarFallback>
                              </Avatar>
                              <span className="font-medium text-sm">{emp.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="capitalize text-sm text-muted-foreground">{emp.role}</TableCell>
                          <TableCell className="text-sm">{emp.hourlyRate ? formatCurrency(emp.hourlyRate) + "/hr" : "—"}</TableCell>
                          <TableCell className="text-sm font-medium">{emp.monthlyRate ? formatCurrency(emp.monthlyRate) : "—"}</TableCell>
                          <TableCell>
                            <Badge className={
                              emp.status === "active" ? "bg-green-100 text-green-800" :
                              emp.status === "terminated" ? "bg-red-100 text-red-800" :
                              "bg-yellow-100 text-yellow-800"
                            }>
                              {emp.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs h-7"
                                onClick={() => { setSelectedEmployee(emp); setBonusAmount(""); setBonusModalOpen(true); }}
                              >
                                + Bonus
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs h-7"
                                onClick={() => { setSelectedEmployee(emp); setHourlyRateInput(emp.hourlyRate ? String(emp.hourlyRate.toFixed(2)) : ""); setHourlyModalOpen(true); }}
                              >
                                Set Rate
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {loadingPayroll ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading payroll...
              </div>
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Base</TableHead>
                      <TableHead>Bonuses</TableHead>
                      <TableHead>Deductions</TableHead>
                      <TableHead>Net Pay</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payroll.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          No payroll records
                        </TableCell>
                      </TableRow>
                    ) : payroll.map(record => (
                      <TableRow key={record.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-xs">
                                {employees.find(e => e.id === record.employeeId)?.avatar || "?"}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium text-sm">{record.employeeName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatMonthRange(record.month, record.year)}
                        </TableCell>
                        <TableCell className="text-sm">{formatCurrency(record.baseSalary)}</TableCell>
                        <TableCell className="text-sm text-green-600">{formatCurrency(record.bonuses)}</TableCell>
                        <TableCell className="text-sm text-red-600">{formatCurrency(record.deductions)}</TableCell>
                        <TableCell className="text-sm font-semibold">{formatCurrency(record.netPay)}</TableCell>
                        <TableCell>
                          <Badge className={payrollStatusColor(record.status)}>{record.status}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {record.status !== "paid" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs h-7 text-green-700 border-green-300 hover:bg-green-50"
                                onClick={() => handleMarkPayrollPaid(record)}
                              >
                                Mark Paid
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7 w-7 p-0"
                              onClick={() => handleHidePayroll(record)}
                              disabled={hidingPayrollId === record.id}
                            >
                              {hidingPayrollId === record.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Invoice Detail Modal */}
      <Dialog open={!!selectedInvoice} onOpenChange={open => !open && setSelectedInvoice(null)}>
        <DialogContent className="max-w-md" aria-describedby="invoice-detail-desc">
          <DialogHeader>
            <DialogTitle>{selectedInvoice?.invoiceNumber}</DialogTitle>
            <DialogDescription id="invoice-detail-desc">Invoice details</DialogDescription>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Client</span>
                <span className="font-medium">{selectedInvoice.clientName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-semibold">{centsToDisplay(selectedInvoice.amount, selectedInvoice.currency)}</span>
              </div>
              {selectedInvoice.amountPaid > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount Paid</span>
                  <span className="text-green-600 font-medium">{centsToDisplay(selectedInvoice.amountPaid, selectedInvoice.currency)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge className={invoiceStatusColor(selectedInvoice.status)}>{selectedInvoice.status.toLowerCase()}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{formatDate(selectedInvoice.createdAt)}</span>
              </div>
              {selectedInvoice.dueDate && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Due</span>
                  <span>{formatDate(selectedInvoice.dueDate)}</span>
                </div>
              )}
              {selectedInvoice.paidAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Paid On</span>
                  <span className="text-green-600">{formatDate(selectedInvoice.paidAt)}</span>
                </div>
              )}
              {selectedInvoice.description && (
                <div className="pt-2 border-t">
                  <p className="text-muted-foreground mb-1">Description</p>
                  <p>{selectedInvoice.description}</p>
                </div>
              )}
              {(selectedInvoice.stripeHostedInvoiceUrl || selectedInvoice.stripePdfUrl) && (
                <div className="flex gap-2 pt-2 border-t">
                  {selectedInvoice.stripeHostedInvoiceUrl && (
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => window.open(selectedInvoice.stripeHostedInvoiceUrl, "_blank")}>
                      <ExternalLink className="h-3 w-3 mr-1" /> View in Stripe
                    </Button>
                  )}
                  {selectedInvoice.stripePdfUrl && (
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => window.open(selectedInvoice.stripePdfUrl, "_blank")}>
                      <FileText className="h-3 w-3 mr-1" /> Download PDF
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bonus Modal */}
      <Dialog open={bonusModalOpen} onOpenChange={setBonusModalOpen}>
        <DialogContent aria-describedby="bonus-desc">
          <DialogHeader>
            <DialogTitle>Add Bonus</DialogTitle>
            <DialogDescription id="bonus-desc">
              One-time bonus for <span className="font-semibold">{selectedEmployee?.name}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Amount ($)</label>
              <Input type="number" value={bonusAmount} onChange={e => setBonusAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setBonusModalOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveBonus}>Save Bonus</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hourly Rate Modal */}
      <Dialog open={hourlyModalOpen} onOpenChange={setHourlyModalOpen}>
        <DialogContent aria-describedby="hourly-desc">
          <DialogHeader>
            <DialogTitle>Set Hourly Rate</DialogTitle>
            <DialogDescription id="hourly-desc">
              Update hourly rate for <span className="font-semibold">{selectedEmployee?.name}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Hourly Rate ($)</label>
              <Input type="number" value={hourlyRateInput} onChange={e => setHourlyRateInput(e.target.value)} placeholder="0.00" />
            </div>
            <div className="text-xs text-muted-foreground bg-muted p-3 rounded-md">
              <p>Approx monthly = hourly × {DEFAULT_WORKING_DAYS} working days × 8 hours</p>
              {hourlyRateInput && (
                <p className="mt-1 font-semibold">
                  Preview: {formatCurrency(parseFloat(hourlyRateInput || "0") * DEFAULT_WORKING_DAYS * 8)}/month
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setHourlyModalOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveHourlyRate}>Save Rate</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Toaster />
    </>
  );
}