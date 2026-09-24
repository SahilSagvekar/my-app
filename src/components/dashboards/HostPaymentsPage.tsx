'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { PageHeader } from '../ui/page-header';
import { FilterSelect } from '../ui/filter-select';
import { Loader2 } from 'lucide-react';

interface Payment {
  id: string;
  label: string;
  amount: string;
  status: 'pending' | 'scheduled' | 'paid';
  method: string | null;
  scheduledDate: string | null;
  sentAt: string | null;
}

interface Stats {
  paidThisYear: number;
  paidCount: number;
  outstandingTotal: number;
  nextPayment: { label: string; date: string | null } | null;
  shootsWorked: number;
}

function fmtDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Awaiting payment',
  scheduled: 'Scheduled',
  paid: 'Paid',
};

export function HostPaymentsPage({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  const load = (status?: string) => {
    setLoading(true);
    const url = status && status !== 'all' ? `/api/host/payments?status=${status}` : '/api/host/payments';
    fetch(url, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((json) => {
        setStats(json.stats);
        setPayments(json.payments || []);
      })
      .catch((err) => console.error('Failed to load payments:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleFilter = (v: string) => {
    setFilter(v);
    load(v);
  };

  if (loading && !stats) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading payments...</p>
      </div>
    );
  }

  const yearToDatePaid = stats?.paidThisYear ?? 0;
  const over600 = yearToDatePaid >= 600;

  return (
    <div className="space-y-6">
      <PageHeader title="Payments" description="What E8 has paid you and what is still coming" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card><CardContent className="p-4">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Paid this year</p>
          <p className="text-xl font-bold mt-1">${yearToDatePaid.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{stats?.paidCount ?? 0} payments received</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Coming to you</p>
          <p className="text-xl font-bold mt-1">${(stats?.outstandingTotal ?? 0).toFixed(2)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {stats?.nextPayment ? `Next: ${stats.nextPayment.label}${stats.nextPayment.date ? ` · ${fmtDate(stats.nextPayment.date)}` : ''}` : 'Nothing scheduled'}
          </p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Shoots worked</p>
          <p className="text-xl font-bold mt-1">{stats?.shootsWorked ?? 0}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Since January {new Date().getFullYear()}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm">Payouts go to your on-file payout method. E8 pays within 7 days of a completed shoot.</p>
          <Button variant="outline" size="sm" onClick={() => onNavigate?.('employment-info')}>
            Change payout method
          </Button>
        </CardContent>
      </Card>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold">Payment history</h3>
          <FilterSelect
            value={filter}
            onValueChange={handleFilter}
            className="h-9 w-[190px] text-xs"
            options={[
              { value: 'all', label: 'All payments' },
              { value: 'pending', label: 'Awaiting payment' },
              { value: 'scheduled', label: 'Scheduled' },
              { value: 'paid', label: 'Paid' },
            ]}
          />
        </div>
        <div className="divide-y border rounded-lg">
          {payments.length === 0 && (
            <p className="text-sm text-muted-foreground px-4 py-6 text-center">No payments yet.</p>
          )}
          {payments.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">{p.label}</span>
                  <Badge variant="outline" className="text-[10px]">{STATUS_LABEL[p.status] || p.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {p.status === 'paid'
                    ? `Sent ${fmtDate(p.sentAt) || '—'} · ${p.method || 'on-file method'}`
                    : `Due ${fmtDate(p.scheduledDate) || 'TBD'} · ${p.method || 'on-file method'}`}
                </p>
              </div>
              <span className="text-sm font-bold shrink-0">${Number(p.amount).toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground border-t pt-4">
        {over600
          ? "You've earned over $600 this year — E8 will issue a 1099-NEC in January. Make sure your W-9 and mailing address are current in Employment Information."
          : 'A 1099-NEC is issued once you pass $600 in earnings for the year.'}
      </p>
    </div>
  );
}
