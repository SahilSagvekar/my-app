'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CreditCard,
  FileText,
  ExternalLink,
  Download,
  Plus,
  RefreshCw,
  Building2,
  Calendar,
  CheckCircle,
  AlertCircle,
  Trash2,
} from 'lucide-react';

interface PaymentMethod {
  id: string;
  type: string;
  isDefault: boolean;
  cardBrand: string | null;
  cardLast4: string | null;
  cardExpMonth: number | null;
  cardExpYear: number | null;
  bankName: string | null;
  bankLast4: string | null;
  bankAccountType: string | null;
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

interface Subscription {
  id: string;
  status: string;
  amount: number;
  currency: string;
  interval: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
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

export function ClientBillingPortal() {
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [hasStripeAccount, setHasStripeAccount] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [invoicesRes, subscriptionsRes, customerRes] = await Promise.all([
        fetch('/api/billing/invoices'),
        fetch('/api/billing/subscriptions'),
        fetch('/api/billing/customers'),
      ]);

      const invoicesData = await invoicesRes.json();
      const subscriptionsData = await subscriptionsRes.json();
      const customerData = await customerRes.json();

      if (invoicesData.ok) {
        setInvoices(invoicesData.invoices);
      }
      if (subscriptionsData.ok) {
        setSubscriptions(subscriptionsData.subscriptions);
      }
      if (customerData.ok) {
        setPaymentMethods(customerData.paymentMethods || []);
        setHasStripeAccount(customerData.hasStripeAccount);
      }
    } catch (error) {
      console.error('Failed to load billing data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handlePayInvoice(invoiceId: string) {
    try {
      const res = await fetch(`/api/billing/invoices/${invoiceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pay' }),
      });

      const data = await res.json();
      if (data.ok && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch (error) {
      console.error('Failed to initiate payment:', error);
    }
  }

  async function handleAddPaymentMethod() {
    try {
      const res = await fetch('/api/billing/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_payment_method' }),
      });

      const data = await res.json();
      if (data.ok && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch (error) {
      console.error('Failed to add payment method:', error);
    }
  }

  async function handleOpenPortal() {
    try {
      const res = await fetch('/api/billing/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'portal' }),
      });

      const data = await res.json();
      if (data.ok && data.portalUrl) {
        window.location.href = data.portalUrl;
      }
    } catch (error) {
      console.error('Failed to open portal:', error);
    }
  }

  async function handleSetDefaultPaymentMethod(paymentMethodId: string) {
    try {
      await fetch('/api/billing/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_default', paymentMethodId }),
      });
      await loadData();
    } catch (error) {
      console.error('Failed to set default payment method:', error);
    }
  }

  async function handleRemovePaymentMethod(paymentMethodId: string) {
    if (!confirm('Are you sure you want to remove this payment method?')) return;

    try {
      await fetch('/api/billing/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove_payment_method', paymentMethodId }),
      });
      await loadData();
    } catch (error) {
      console.error('Failed to remove payment method:', error);
    }
  }

  // Separate invoices
  const unpaidInvoices = invoices.filter((inv) =>
    ['SENT', 'PENDING', 'PARTIALLY_PAID', 'OVERDUE'].includes(inv.status)
  );
  const paidInvoices = invoices.filter((inv) => inv.status === 'PAID');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Billing</h1>
          <p className="text-muted-foreground">Manage your invoices and payment methods</p>
        </div>
        {hasStripeAccount && (
          <Button variant="outline" onClick={handleOpenPortal}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Manage Billing
          </Button>
        )}
      </div>

      {/* Outstanding Invoices */}
      {unpaidInvoices.length > 0 && (
        <Card className="border-orange-200 bg-orange-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-600" />
              Outstanding Invoices
            </CardTitle>
            <CardDescription>
              You have {unpaidInvoices.length} invoice{unpaidInvoices.length > 1 ? 's' : ''} awaiting payment
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {unpaidInvoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-4 bg-white rounded-lg border"
                >
                  <div className="flex items-center gap-4">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{invoice.invoiceNumber}</p>
                      <p className="text-sm text-muted-foreground">
                        {invoice.description || 'Invoice'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Due: {formatDate(invoice.dueDate)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(invoice.amount - invoice.amountPaid)}</p>
                      <Badge className={statusColors[invoice.status]}>
                        {invoice.status === 'OVERDUE' ? 'Overdue' : 'Due'}
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      {invoice.stripePdfUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(invoice.stripePdfUrl!, '_blank')}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                      <Button size="sm" onClick={() => handlePayInvoice(invoice.id)}>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment Methods */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Payment Methods</CardTitle>
              <Button variant="outline" size="sm" onClick={handleAddPaymentMethod}>
                <Plus className="h-4 w-4 mr-2" />
                Add
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {paymentMethods.length > 0 ? (
              <div className="space-y-3">
                {paymentMethods.map((pm) => (
                  <div
                    key={pm.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {pm.type === 'card' ? (
                        <CreditCard className="h-8 w-8 text-muted-foreground" />
                      ) : (
                        <Building2 className="h-8 w-8 text-muted-foreground" />
                      )}
                      <div>
                        {pm.type === 'card' ? (
                          <>
                            <p className="font-medium capitalize">
                              {pm.cardBrand} •••• {pm.cardLast4}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Expires {pm.cardExpMonth}/{pm.cardExpYear}
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="font-medium">
                              {pm.bankName} •••• {pm.bankLast4}
                            </p>
                            <p className="text-sm text-muted-foreground capitalize">
                              {pm.bankAccountType} Account
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {pm.isDefault ? (
                        <Badge variant="outline" className="text-green-600">
                          Default
                        </Badge>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSetDefaultPaymentMethod(pm.id)}
                        >
                          Set Default
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-red-600"
                        onClick={() => handleRemovePaymentMethod(pm.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground mb-4">No payment methods on file</p>
                <Button onClick={handleAddPaymentMethod}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Payment Method
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Subscriptions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Subscriptions</CardTitle>
          </CardHeader>
          <CardContent>
            {subscriptions.length > 0 ? (
              <div className="space-y-3">
                {subscriptions.map((sub) => (
                  <div key={sub.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge className={statusColors[sub.status]}>{sub.status}</Badge>
                        {sub.cancelAtPeriodEnd && (
                          <span className="text-xs text-red-600">Canceling at period end</span>
                        )}
                      </div>
                      <p className="font-semibold">
                        {formatCurrency(sub.amount)}/{sub.interval}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>
                        Next billing: {formatDate(sub.currentPeriodEnd)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p>No active subscriptions</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Invoice History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Invoice History</CardTitle>
        </CardHeader>
        <CardContent>
          {paidInvoices.length > 0 ? (
            <div className="space-y-2">
              {paidInvoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30"
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium">{invoice.invoiceNumber}</p>
                      <p className="text-sm text-muted-foreground">
                        Paid on {formatDate(invoice.paidAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="font-medium">{formatCurrency(invoice.amount)}</p>
                    {invoice.stripePdfUrl && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(invoice.stripePdfUrl!, '_blank')}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        PDF
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No paid invoices yet
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}