"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  FileText,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  Loader2,
  AlertCircle,
  Search,
  User,
  Building2,
  Mail,
  Phone,
  Calendar,
  Video,
  Image,
  Film,
  CheckCircle,
  XCircle,
  CreditCard,
  Receipt,
  ExternalLink,
  RefreshCw,
  DollarSign,
  FileSignature,
  Package,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ContractStatusBadge, SignerStatusBadge } from "../components/contracts/ContractStatusBadge";
import { ContractDetailView } from "../components/contracts/ContractDetailView";

// Types
interface MonthlyDeliverable {
  id: string;
  type: string;
  quantity: number;
  platforms?: string[];
  description?: string;
}

interface ClientInfo {
  id: string;
  name: string;
  companyName?: string;
  email: string;
  emails?: string[];
  phone?: string;
  phones?: string[];
  hasPostingServices: boolean;
  monthlyDeliverables: MonthlyDeliverable[];
  billing?: {
    monthlyFee: string;
    billingFrequency: string;
    billingDay: number;
    nextBillingDate?: string;
  };
  createdAt: string;
}

interface Contract {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  completedAt?: string;
  signers: Array<{
    id: string;
    name: string;
    email: string;
    status: string;
  }>;
  createdBy?: {
    name?: string;
    email: string;
  };
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  status: string;
  amount: number;
  amountPaid: number;
  currency: string;
  dueDate: string | null;
  description: string | null;
  stripeHostedInvoiceUrl: string | null;
  stripePdfUrl: string | null;
  createdAt: string;
  paidAt: string | null;
}

// Helpers
function formatCurrency(amountInCents: number, currency: string = "usd"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountInCents / 100);
}

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const invoiceStatusColors: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-800",
  PENDING: "bg-yellow-100 text-yellow-800",
  SENT: "bg-blue-100 text-blue-800",
  PAID: "bg-green-100 text-green-800",
  PARTIALLY_PAID: "bg-orange-100 text-orange-800",
  OVERDUE: "bg-red-100 text-red-800",
  CANCELED: "bg-gray-100 text-gray-600",
};

// Platform abbreviations for display
const platformAbbrev: Record<string, string> = {
  Instagram: "IG",
  Tiktok: "TT",
  TikTok: "TT",
  Facebook: "FB",
  Youtube: "YT",
  YouTube: "YT",
  Twitter: "X",
  Linkedin: "LI",
  LinkedIn: "LI",
  Snapchat: "SC",
};

export function ClientPortalPage() {
  const [loading, setLoading] = useState(true);
  const [clientInfo, setClientInfo] = useState<ClientInfo | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch all data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch client info, contracts, and invoices in parallel
      const [clientRes, contractsRes, invoicesRes] = await Promise.all([
        fetch("/api/client/me", { credentials: "include" }),
        fetch(`/api/contracts${searchQuery ? `?search=${searchQuery}` : ""}`, {
          credentials: "include",
        }),
        fetch("/api/billing/invoices", { credentials: "include" }),
      ]);

      if (clientRes.ok) {
        const clientData = await clientRes.json();
        setClientInfo(clientData.client || clientData);
      }

      if (contractsRes.ok) {
        const contractsData = await contractsRes.json();
        // Handle both array and { ok, contracts } response formats
        setContracts(Array.isArray(contractsData) ? contractsData : contractsData.contracts || []);
      }

      if (invoicesRes.ok) {
        const invoicesData = await invoicesRes.json();
        setInvoices(invoicesData.invoices || []);
      }
    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Contract download
  const handleDownload = async (contractId: string, type: "original" | "signed") => {
    try {
      const res = await fetch(`/api/contracts/${contractId}/download?type=${type}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        window.open(data.downloadUrl, "_blank");
      }
    } catch (err) {
      console.error("Download failed:", err);
    }
  };

  // Pay invoice
  const handlePayInvoice = async (invoiceId: string) => {
    try {
      const res = await fetch(`/api/billing/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "pay" }),
      });

      const data = await res.json();
      if (data.ok && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else if (data.stripeHostedInvoiceUrl) {
        window.location.href = data.stripeHostedInvoiceUrl;
      }
    } catch (error) {
      console.error("Failed to initiate payment:", error);
    }
  };

  // If viewing a specific contract
  if (selectedContractId) {
    return (
      <div className="space-y-6">
        <ContractDetailView
          contractId={selectedContractId}
          onBack={() => {
            setSelectedContractId(null);
            fetchData();
          }}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  // Categorize contracts
  const needsAction = contracts.filter(
    (c) => c.status === "SENT" || c.status === "PARTIALLY_SIGNED"
  );
  const completedContracts = contracts.filter((c) => c.status === "COMPLETED");
  const otherContracts = contracts.filter(
    (c) =>
      c.status !== "SENT" &&
      c.status !== "PARTIALLY_SIGNED" &&
      c.status !== "COMPLETED"
  );

  // Categorize invoices
  const unpaidInvoices = invoices.filter((inv) =>
    ["SENT", "PENDING", "PARTIALLY_PAID", "OVERDUE"].includes(inv.status)
  );
  const paidInvoices = invoices.filter((inv) => inv.status === "PAID");

  // Calculate total deliverables
  const totalDeliverables = clientInfo?.monthlyDeliverables?.reduce(
    (sum, d) => sum + d.quantity,
    0
  ) || 0;

  return (
    <div className="space-y-12 pb-12">
      {/* ===== SECTION 1: CLIENT INFO ===== */}
      <section>
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Welcome Back
          </h1>
          <p className="text-muted-foreground mt-1 text-lg">
            View your account details, contracts, and invoices
          </p>
        </div>

        {clientInfo ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Company Info Card */}
            <Card className="lg:col-span-1">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-blue-600" />
                  Account Info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {clientInfo.companyName || clientInfo.name}
                  </p>
                  {clientInfo.companyName && (
                    <p className="text-sm text-gray-500">{clientInfo.name}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-gray-400" />
                    <span>{clientInfo.email}</span>
                  </div>
                  {clientInfo.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-gray-400" />
                      <span>{clientInfo.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span>Client since {formatDate(clientInfo.createdAt)}</span>
                  </div>
                </div>

                {/* Posting Services Status */}
                <div className="pt-3 border-t">
                  <div
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                      clientInfo.hasPostingServices
                        ? "bg-green-50 text-green-700"
                        : "bg-gray-50 text-gray-600"
                    }`}
                  >
                    {clientInfo.hasPostingServices ? (
                      <>
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-sm font-medium">
                          Posting Services Included
                        </span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4" />
                        <span className="text-sm font-medium">
                          Content Delivery Only
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Monthly Deliverables Card */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Package className="h-5 w-5 text-indigo-600" />
                    Monthly Deliverables
                  </CardTitle>
                  <Badge variant="secondary" className="text-base px-3 py-1">
                    {totalDeliverables} total/month
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {clientInfo.monthlyDeliverables?.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {clientInfo.monthlyDeliverables.map((deliverable) => {
                      const platforms =
                        deliverable.platforms
                          ?.map((p) => platformAbbrev[p] || p)
                          .join(", ") || "";

                      // Choose icon based on type
                      let Icon = Video;
                      if (
                        deliverable.type.toLowerCase().includes("short") ||
                        deliverable.type.toLowerCase().includes("reel")
                      ) {
                        Icon = Film;
                      } else if (
                        deliverable.type.toLowerCase().includes("image") ||
                        deliverable.type.toLowerCase().includes("photo")
                      ) {
                        Icon = Image;
                      }

                      return (
                        <div
                          key={deliverable.id}
                          className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100"
                        >
                          <div className="p-2 bg-white rounded-lg border">
                            <Icon className="h-5 w-5 text-indigo-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate">
                              {deliverable.type}
                            </p>
                            {platforms && (
                              <p className="text-xs text-gray-500">{platforms}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="text-lg font-bold text-indigo-600">
                              {deliverable.quantity}
                            </span>
                            <span className="text-xs text-gray-500">/mo</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p>No deliverables configured yet</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Billing Summary Card */}
            {clientInfo.billing?.monthlyFee && (
              <Card className="lg:col-span-3">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-green-100 rounded-xl">
                        <DollarSign className="h-6 w-6 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Monthly Fee</p>
                        <p className="text-2xl font-bold text-gray-900">
                          ${parseFloat(clientInfo.billing.monthlyFee.replace(/[^0-9.]/g, "")).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Billing Cycle</p>
                      <p className="font-medium text-gray-900 capitalize">
                        {clientInfo.billing.billingFrequency || "Monthly"}
                      </p>
                      {clientInfo.billing.billingDay && (
                        <p className="text-xs text-gray-500">
                          Day {clientInfo.billing.billingDay} of each month
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              <User className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>Unable to load account information</p>
            </CardContent>
          </Card>
        )}
      </section>

      <Separator />

      {/* ===== SECTION 2: CONTRACTS ===== */}
      <section>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
              <FileSignature className="h-6 w-6 text-blue-600" />
              My Contracts
            </h2>
            <p className="text-muted-foreground mt-1">
              Review and sign your legal documents
            </p>
          </div>

          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search contracts..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white shadow-sm"
            />
          </div>
        </div>

        {contracts.length === 0 ? (
          <div className="text-center py-16 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
            <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 mb-1">
              No contracts yet
            </h3>
            <p className="text-sm text-gray-400">
              You'll see contracts here when they are sent to you
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Needs Action */}
            {needsAction.length > 0 && (
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <div className="p-1.5 bg-amber-100 rounded-md">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                  </div>
                  Needs Your Signature ({needsAction.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {needsAction.map((contract) => (
                    <ContractCard
                      key={contract.id}
                      contract={contract}
                      onDownload={handleDownload}
                      onSelect={(id) => setSelectedContractId(id)}
                      showSignButton
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Completed */}
            {completedContracts.length > 0 && (
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <div className="p-1.5 bg-green-100 rounded-md">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  </div>
                  Completed ({completedContracts.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {completedContracts.map((contract) => (
                    <ContractCard
                      key={contract.id}
                      contract={contract}
                      onDownload={handleDownload}
                      onSelect={(id) => setSelectedContractId(id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Other */}
            {otherContracts.length > 0 && (
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4">
                  Other ({otherContracts.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {otherContracts.map((contract) => (
                    <ContractCard
                      key={contract.id}
                      contract={contract}
                      onDownload={handleDownload}
                      onSelect={(id) => setSelectedContractId(id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <Separator />

      {/* ===== SECTION 3: INVOICES ===== */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
              <Receipt className="h-6 w-6 text-green-600" />
              Invoices & Payments
            </h2>
            <p className="text-muted-foreground mt-1">
              View and pay your invoices
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Unpaid Invoices */}
        {unpaidInvoices.length > 0 && (
          <Card className="mb-6 border-amber-200 bg-amber-50/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2 text-amber-800">
                <AlertCircle className="h-5 w-5" />
                Pending Payment ({unpaidInvoices.length})
              </CardTitle>
              <CardDescription className="text-amber-700">
                You have {unpaidInvoices.length} invoice
                {unpaidInvoices.length > 1 ? "s" : ""} awaiting payment
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {unpaidInvoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between p-4 bg-white rounded-lg border shadow-sm"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2.5 bg-amber-100 rounded-lg">
                        <FileText className="h-5 w-5 text-amber-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">
                          {invoice.invoiceNumber}
                        </p>
                        <p className="text-sm text-gray-500 line-clamp-1 max-w-md">
                          {invoice.description || "Invoice"}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Due: {formatDate(invoice.dueDate)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-xl font-bold text-gray-900">
                          {formatCurrency(invoice.amount - invoice.amountPaid, invoice.currency)}
                        </p>
                        <Badge className={invoiceStatusColors[invoice.status]}>
                          {invoice.status === "OVERDUE" ? "Overdue" : "Due"}
                        </Badge>
                      </div>
                      <div className="flex gap-2">
                        {invoice.stripePdfUrl && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(invoice.stripePdfUrl!, "_blank")}
                            title="Download PDF"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => handlePayInvoice(invoice.id)}
                        >
                          <CreditCard className="h-4 w-4 mr-2" />
                          Pay Now
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Invoice History */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Payment History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {paidInvoices.length > 0 ? (
              <div className="space-y-2">
                {paidInvoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="font-medium text-gray-900">
                          {invoice.invoiceNumber}
                        </p>
                        <p className="text-xs text-gray-500">
                          Paid on {formatDate(invoice.paidAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="font-semibold text-gray-900">
                        {formatCurrency(invoice.amount, invoice.currency)}
                      </p>
                      {invoice.stripePdfUrl && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(invoice.stripePdfUrl!, "_blank")}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Receipt
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Receipt className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No payment history yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* No invoices at all */}
        {invoices.length === 0 && (
          <div className="text-center py-16 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 mt-6">
            <Receipt className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 mb-1">
              No invoices yet
            </h3>
            <p className="text-sm text-gray-400">
              Invoices will appear here when they are sent to you
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

// Contract Card Component (same as before)
function ContractCard({
  contract,
  onDownload,
  onSelect,
  showSignButton,
}: {
  contract: Contract;
  onDownload: (id: string, type: "original" | "signed") => void;
  onSelect: (id: string) => void;
  showSignButton?: boolean;
}) {
  return (
    <div
      className="bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group"
      onClick={() => onSelect(contract.id)}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
            <FileText className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
              {contract.title}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              From {contract.createdBy?.name || contract.createdBy?.email} •{" "}
              {new Date(contract.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ContractStatusBadge status={contract.status} />
        </div>
      </div>

      {/* Signers Preview */}
      <div className="mt-4 flex items-center gap-2 flex-wrap">
        {contract.signers?.map((signer) => (
          <div
            key={signer.id}
            className="inline-flex items-center gap-1.5 bg-gray-50 rounded-full px-2.5 py-1 border border-gray-100"
          >
            <div
              className={`w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center ${
                signer.status === "SIGNED"
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-200 text-gray-600"
              }`}
            >
              {signer.name?.[0]?.toUpperCase()}
            </div>
            <span className="text-xs text-gray-600">{signer.name}</span>
            <SignerStatusBadge status={signer.status} />
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="mt-5 flex items-center gap-2 pt-4 border-t border-gray-50">
        {showSignButton ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect(contract.id);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            ✍️ Review & Sign
          </button>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect(contract.id);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
          >
            <Eye className="h-3.5 w-3.5" />
            View Details
          </button>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation();
            onDownload(contract.id, contract.status === "COMPLETED" ? "signed" : "original");
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50 rounded-lg transition-colors ml-auto"
        >
          <Download className="h-3.5 w-3.5" />
          PDF
        </button>
      </div>
    </div>
  );
}