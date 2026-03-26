'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DollarSign,
  FileText,
  CreditCard,
  TrendingUp,
  Plus,
  Search,
  Filter,
  Send,
  Eye,
  MoreHorizontal,
  RefreshCw,
  Download,
  ExternalLink,
  Users,
  Calendar,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CreateInvoiceModal } from './CreateInvoiceModal';

interface Invoice {
  id: string;
  invoiceNumber: string;
  status: string;
  amount: number;
  amountPaid: number;
  currency: string;
  dueDate: string | null;
  description: string | null;
  createdAt: string;
  sentAt: string | null;
  paidAt: string | null;
  stripeHostedInvoiceUrl: string | null;
  stripePdfUrl: string | null;
  stripeCustomer: {
    client: {
      id: string;
      name: string;
      companyName: string | null;
      email: string;
    };
  };
  lineItems: Array<{ description: string; amount: number; quantity: number }>;
}

interface Subscription {
  id: string;
  status: string;
  amount: number;
  currency: string;
  interval: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  stripeCustomer: {
    client: {
      id: string;
      name: string;
      companyName: string | null;
    };
  };
}

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  PENDING: 'bg-yellow-100 text-yellow-800',
  SENT: 'bg-blue-100 text-blue-800',
  PAID: 'bg-green-100 text-green-800',
  PARTIALLY_PAID: 'bg-orange-100 text-orange-800',
  OVERDUE: 'bg-red-100 text-red-800',
  CANCELED: 'bg-gray-100 text-gray-600',
  ACTIVE: 'bg-green-100 text-green-800',
  PAST_DUE: 'bg-red-100 text-red-800',
  TRIALING: 'bg-purple-100 text-purple-800',
};

function formatCurrency(amountInCents: number, currency: string = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amountInCents / 100);
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function BillingDashboard() {
  const [activeTab, setActiveTab] = useState<'invoices' | 'subscriptions' | 'plans'>('invoices');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Summary stats
  const [stats, setStats] = useState({
    totalRevenue: 0,
    pendingAmount: 0,
    overdueAmount: 0,
    activeSubscriptions: 0,
    mrr: 0,
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [invoicesRes, subscriptionsRes] = await Promise.all([
        fetch('/api/billing/invoices?limit=100'),
        fetch('/api/billing/subscriptions'),
      ]);

      const invoicesData = await invoicesRes.json();
      const subscriptionsData = await subscriptionsRes.json();

      if (invoicesData.ok) {
        setInvoices(invoicesData.invoices);
        calculateStats(invoicesData.invoices, subscriptionsData.subscriptions || []);
      }

      if (subscriptionsData.ok) {
        setSubscriptions(subscriptionsData.subscriptions);
      }
    } catch (error) {
      console.error('Failed to load billing data:', error);
    } finally {
      setLoading(false);
    }
  }

  function calculateStats(invoices: Invoice[], subscriptions: Subscription[]) {
    const totalRevenue = invoices
      .filter(inv => inv.status === 'PAID')
      .reduce((sum, inv) => sum + inv.amountPaid, 0);

    const pendingAmount = invoices
      .filter(inv => ['SENT', 'PENDING', 'PARTIALLY_PAID'].includes(inv.status))
      .reduce((sum, inv) => sum + (inv.amount - inv.amountPaid), 0);

    const overdueAmount = invoices
      .filter(inv => inv.status === 'OVERDUE')
      .reduce((sum, inv) => sum + (inv.amount - inv.amountPaid), 0);

    const activeSubscriptions = subscriptions.filter(
      sub => ['ACTIVE', 'TRIALING'].includes(sub.status)
    ).length;

    const mrr = subscriptions
      .filter(sub => ['ACTIVE', 'TRIALING'].includes(sub.status))
      .reduce((sum, sub) => {
        const monthlyAmount = sub.interval === 'year' ? sub.amount / 12 : sub.amount;
        return sum + monthlyAmount;
      }, 0);

    setStats({ totalRevenue, pendingAmount, overdueAmount, activeSubscriptions, mrr });
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }

  async function handleSendInvoice(invoiceId: string) {
    try {
      const res = await fetch(`/api/billing/invoices/${invoiceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send' }),
      });

      if (res.ok) {
        await loadData();
      }
    } catch (error) {
      console.error('Failed to send invoice:', error);
    }
  }

  async function handleVoidInvoice(invoiceId: string) {
    if (!confirm('Are you sure you want to void this invoice?')) return;

    try {
      const res = await fetch(`/api/billing/invoices/${invoiceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'void' }),
      });

      if (res.ok) {
        await loadData();
      }
    } catch (error) {
      console.error('Failed to void invoice:', error);
    }
  }

  // Filter invoices
  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch =
      searchQuery === '' ||
      invoice.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.stripeCustomer.client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.stripeCustomer.client.companyName?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-xl font-semibold">{formatCurrency(stats.totalRevenue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <TrendingUp className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">MRR</p>
                <p className="text-xl font-semibold">{formatCurrency(stats.mrr)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <FileText className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-xl font-semibold">{formatCurrency(stats.pendingAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <Calendar className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Overdue</p>
                <p className="text-xl font-semibold">{formatCurrency(stats.overdueAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Subs</p>
                <p className="text-xl font-semibold">{stats.activeSubscriptions}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'invoices'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('invoices')}
        >
          Invoices
        </button>
        <button
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'subscriptions'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('subscriptions')}
        >
          Subscriptions
        </button>
      </div>

      {/* Invoices Tab */}
      {activeTab === 'invoices' && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <CardTitle className="text-lg">Invoices</CardTitle>
              <div className="flex gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-initial">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search invoices..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-full sm:w-[200px]"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[130px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="SENT">Sent</SelectItem>
                    <SelectItem value="PAID">Paid</SelectItem>
                    <SelectItem value="OVERDUE">Overdue</SelectItem>
                    <SelectItem value="CANCELED">Canceled</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleRefresh}
                  disabled={refreshing}
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                </Button>
                <Button onClick={() => setShowCreateModal(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Invoice
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left py-3 px-4 font-medium">Invoice</th>
                    <th className="text-left py-3 px-4 font-medium">Client</th>
                    <th className="text-left py-3 px-4 font-medium">Amount</th>
                    <th className="text-left py-3 px-4 font-medium">Status</th>
                    <th className="text-left py-3 px-4 font-medium">Due Date</th>
                    <th className="text-left py-3 px-4 font-medium">Created</th>
                    <th className="text-right py-3 px-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((invoice) => (
                    <tr key={invoice.id} className="border-b hover:bg-muted/30">
                      <td className="py-3 px-4">
                        <span className="font-medium">{invoice.invoiceNumber}</span>
                        {invoice.description && (
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {invoice.description}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-medium">
                          {invoice.stripeCustomer.client.companyName || invoice.stripeCustomer.client.name}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-medium">{formatCurrency(invoice.amount, invoice.currency)}</span>
                        {invoice.amountPaid > 0 && invoice.amountPaid < invoice.amount && (
                          <p className="text-xs text-muted-foreground">
                            Paid: {formatCurrency(invoice.amountPaid, invoice.currency)}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <Badge className={statusColors[invoice.status] || 'bg-gray-100'}>
                          {invoice.status.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {formatDate(invoice.dueDate)}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {formatDate(invoice.createdAt)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            {invoice.status === 'DRAFT' && (
                              <DropdownMenuItem onClick={() => handleSendInvoice(invoice.id)}>
                                <Send className="h-4 w-4 mr-2" />
                                Send Invoice
                              </DropdownMenuItem>
                            )}
                            {invoice.stripeHostedInvoiceUrl && (
                              <DropdownMenuItem
                                onClick={() => window.open(invoice.stripeHostedInvoiceUrl!, '_blank')}
                              >
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Payment Link
                              </DropdownMenuItem>
                            )}
                            {invoice.stripePdfUrl && (
                              <DropdownMenuItem
                                onClick={() => window.open(invoice.stripePdfUrl!, '_blank')}
                              >
                                <Download className="h-4 w-4 mr-2" />
                                Download PDF
                              </DropdownMenuItem>
                            )}
                            {invoice.status !== 'PAID' && invoice.status !== 'CANCELED' && (
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => handleVoidInvoice(invoice.id)}
                              >
                                Void Invoice
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredInvoices.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  {searchQuery || statusFilter !== 'all'
                    ? 'No invoices match your filters'
                    : 'No invoices yet. Create your first invoice!'}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Subscriptions Tab */}
      {activeTab === 'subscriptions' && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Active Subscriptions</CardTitle>
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left py-3 px-4 font-medium">Client</th>
                    <th className="text-left py-3 px-4 font-medium">Amount</th>
                    <th className="text-left py-3 px-4 font-medium">Billing</th>
                    <th className="text-left py-3 px-4 font-medium">Status</th>
                    <th className="text-left py-3 px-4 font-medium">Next Billing</th>
                    <th className="text-right py-3 px-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptions.map((sub) => (
                    <tr key={sub.id} className="border-b hover:bg-muted/30">
                      <td className="py-3 px-4">
                        <span className="font-medium">
                          {sub.stripeCustomer.client.companyName || sub.stripeCustomer.client.name}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium">
                        {formatCurrency(sub.amount, sub.currency)}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground capitalize">
                        {sub.interval}ly
                      </td>
                      <td className="py-3 px-4">
                        <Badge className={statusColors[sub.status] || 'bg-gray-100'}>
                          {sub.status}
                        </Badge>
                        {sub.cancelAtPeriodEnd && (
                          <span className="ml-2 text-xs text-red-600">Canceling</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {formatDate(sub.currentPeriodEnd)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            {!sub.cancelAtPeriodEnd && sub.status === 'ACTIVE' && (
                              <DropdownMenuItem className="text-red-600">
                                Cancel Subscription
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {subscriptions.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No active subscriptions
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Invoice Modal */}
      {showCreateModal && (
        <CreateInvoiceModal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadData();
          }}
        />
      )}
    </div>
  );
}