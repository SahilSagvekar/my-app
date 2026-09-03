'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ExternalLink, Loader2, Receipt } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

type Expense = { id: string; description: string; amount: number; expenseDate: string; receiptFileName: string; receiptUrl: string; status: 'PENDING' | 'INVOICED' | 'PAID' };
type Trip = { id: string; name: string; totalAmount: number; status: 'EMPTY' | 'PENDING' | 'INVOICED' | 'PAID'; expenses: Expense[] };

const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
const date = (value: string) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const badgeClass: Record<Trip['status'], string> = {
  EMPTY: 'bg-gray-100 text-gray-600', PENDING: 'bg-amber-100 text-amber-800',
  INVOICED: 'bg-blue-100 text-blue-800', PAID: 'bg-green-100 text-green-800',
};

export function ClientExpensesPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const load = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/client/expenses', { credentials: 'include' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load expenses');
      setTrips(data.trips || []);
    } catch (error: any) {
      toast.error(error.message || 'Unable to load expenses');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const toggle = (id: string) => setOpen((current) => {
    const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next;
  });

  return <div className="max-w-5xl mx-auto space-y-6">
    <div><h1 className="text-3xl font-bold tracking-tight text-gray-900">Expenses</h1><p className="mt-1 text-muted-foreground">View reimbursable expenses and their receipts.</p></div>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><Receipt className="h-5 w-5" /> Expense trips</CardTitle></CardHeader><CardContent className="space-y-3">
      {loading ? <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div>
        : trips.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">There are no expenses to show.</p>
        : trips.map((trip) => <div key={trip.id} className="rounded-lg border border-gray-200 overflow-hidden">
          <button type="button" onClick={() => toggle(trip.id)} className="w-full p-4 flex items-center gap-3 text-left hover:bg-gray-50">
            <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${open.has(trip.id) ? 'rotate-180' : ''}`} />
            <span className="flex-1 font-medium text-gray-900">{trip.name}</span><Badge className={badgeClass[trip.status]}>{trip.status}</Badge>
            <span className="font-semibold text-gray-900">{money(trip.totalAmount)}</span>
          </button>
          {open.has(trip.id) && <div className="border-t border-gray-200 p-3">
            {trip.expenses.length === 0 ? <p className="p-3 text-sm text-muted-foreground">No receipts in this trip.</p> : trip.expenses.map((expense) => <div key={expense.id} className="flex flex-wrap items-center gap-3 py-3 border-b last:border-0">
              <div className="min-w-[180px] flex-1"><p className="text-sm font-medium">{expense.description}</p><p className="text-xs text-muted-foreground">{date(expense.expenseDate)} · {expense.receiptFileName}</p></div>
              <Badge className={badgeClass[expense.status]}>{expense.status}</Badge><span className="font-medium">{money(expense.amount)}</span>
              <Button asChild variant="outline" size="sm"><a href={expense.receiptUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-1 h-3.5 w-3.5" /> View receipt</a></Button>
            </div>)}
          </div>}
        </div>)}
    </CardContent></Card>
  </div>;
}
