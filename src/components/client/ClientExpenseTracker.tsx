'use client';

// src/components/client/ClientExpenseTracker.tsx
//
// Shown in the client edit form (see ClientManagement.tsx), right alongside
// ClientContractsInvoices — expenses a client gets billed for (travel,
// receipts, etc.), grouped into named "trips" so two trips' receipts never
// get batched into the same invoice by accident. Backend: see
// /api/clients/[id]/expense-trips (list/create) and its [tripId]/expenses
// and [tripId]/invoice sub-routes.

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import {
  Receipt, Plus, Upload, Trash2, ChevronDown, ExternalLink, Send, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

interface Expense {
  id: string;
  description: string;
  amount: number;
  expenseDate: string;
  receiptUrl: string;
  receiptFileName: string;
  status: 'PENDING' | 'INVOICED' | 'PAID';
}

interface Trip {
  id: string;
  name: string;
  expenses: Expense[];
  totalAmount: number;
  pendingAmount: number;
  status: 'EMPTY' | 'PENDING' | 'INVOICED' | 'PAID';
}

const tripStatusColor = (status: Trip['status']) => {
  switch (status) {
    case 'PAID': return 'bg-green-100 text-green-800';
    case 'INVOICED': return 'bg-blue-100 text-blue-800';
    case 'PENDING': return 'bg-amber-100 text-amber-800';
    default: return 'bg-gray-100 text-gray-600';
  }
};

const expenseStatusColor = (status: Expense['status']) => {
  switch (status) {
    case 'PAID': return 'bg-green-100 text-green-800';
    case 'INVOICED': return 'bg-blue-100 text-blue-800';
    default: return 'bg-amber-100 text-amber-800';
  }
};

export function ClientExpenseTracker({ clientId }: { clientId: string }) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [openTripIds, setOpenTripIds] = useState<Set<string>>(new Set());
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<Record<string, Set<string>>>({});

  const [newTripDialogOpen, setNewTripDialogOpen] = useState(false);
  const [newTripName, setNewTripName] = useState('');
  const [creatingTrip, setCreatingTrip] = useState(false);

  const [uploadDialogTripId, setUploadDialogTripId] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadAmount, setUploadAmount] = useState('');
  const [uploadDate, setUploadDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [uploading, setUploading] = useState(false);

  const [invoicingTripId, setInvoicingTripId] = useState<string | null>(null);

  const fetchTrips = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/clients/${clientId}/expense-trips`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load expenses');
      setTrips(data.trips || []);
    } catch (err: any) {
      toast.error('Error loading expenses', { description: err.message });
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => { fetchTrips(); }, [fetchTrips]);

  const toggleTripOpen = (tripId: string) => {
    setOpenTripIds((prev) => {
      const next = new Set(prev);
      if (next.has(tripId)) next.delete(tripId); else next.add(tripId);
      return next;
    });
  };

  const toggleExpenseSelected = (tripId: string, expenseId: string) => {
    setSelectedExpenseIds((prev) => {
      const current = new Set(prev[tripId] || []);
      if (current.has(expenseId)) current.delete(expenseId); else current.add(expenseId);
      return { ...prev, [tripId]: current };
    });
  };

  const handleCreateTrip = async () => {
    if (!newTripName.trim()) return;
    try {
      setCreatingTrip(true);
      const res = await fetch(`/api/clients/${clientId}/expense-trips`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTripName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create trip');
      setTrips((prev) => [data.trip, ...prev]);
      setOpenTripIds((prev) => new Set(prev).add(data.trip.id));
      setNewTripDialogOpen(false);
      setNewTripName('');
      toast.success('Trip created');
    } catch (err: any) {
      toast.error('Error creating trip', { description: err.message });
    } finally {
      setCreatingTrip(false);
    }
  };

  const handleUploadReceipt = async () => {
    if (!uploadDialogTripId || !uploadFile || !uploadDescription.trim() || !uploadAmount) return;
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('description', uploadDescription.trim());
      formData.append('amount', uploadAmount);
      formData.append('expenseDate', uploadDate);

      const res = await fetch(`/api/clients/${clientId}/expense-trips/${uploadDialogTripId}/expenses`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to upload receipt');

      setTrips((prev) => prev.map((t) => t.id === uploadDialogTripId
        ? { ...t, expenses: [data.expense, ...t.expenses], totalAmount: t.totalAmount + data.expense.amount, pendingAmount: t.pendingAmount + data.expense.amount, status: 'PENDING' }
        : t));
      setUploadDialogTripId(null);
      setUploadFile(null);
      setUploadDescription('');
      setUploadAmount('');
      setUploadDate(new Date().toISOString().slice(0, 10));
      toast.success('Receipt uploaded');
    } catch (err: any) {
      toast.error('Error uploading receipt', { description: err.message });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteExpense = async (tripId: string, expenseId: string) => {
    try {
      const res = await fetch(`/api/clients/${clientId}/expense-trips/${tripId}/expenses/${expenseId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete expense');
      await fetchTrips();
      toast.success('Expense removed');
    } catch (err: any) {
      toast.error('Error removing expense', { description: err.message });
    }
  };

  const handleCreateInvoice = async (tripId: string) => {
    const expenseIds = Array.from(selectedExpenseIds[tripId] || []);
    if (expenseIds.length === 0) return;
    try {
      setInvoicingTripId(tripId);
      const res = await fetch(`/api/clients/${clientId}/expense-trips/${tripId}/invoice`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expenseIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create invoice');
      setSelectedExpenseIds((prev) => ({ ...prev, [tripId]: new Set() }));
      await fetchTrips();
      toast.success('Invoice sent to client');
    } catch (err: any) {
      toast.error('Error creating invoice', { description: err.message });
    } finally {
      setInvoicingTripId(null);
    }
  };

  return (
    <Card className="bg-white border-gray-200">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-gray-900 flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          Expenses
        </CardTitle>
        <Button size="sm" onClick={() => setNewTripDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> New Trip
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="text-center py-8 text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin mx-auto" />
          </div>
        ) : trips.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-6">
            No trips yet — start one to begin uploading receipts.
          </p>
        ) : trips.map((trip) => {
          const isOpen = openTripIds.has(trip.id);
          const selected = selectedExpenseIds[trip.id] || new Set<string>();
          const pendingExpenses = trip.expenses.filter((e) => e.status === 'PENDING');

          return (
            <Collapsible key={trip.id} open={isOpen} onOpenChange={() => toggleTripOpen(trip.id)}>
              <div className="border border-gray-200 rounded-lg">
                <CollapsibleTrigger className="w-full flex items-center justify-between p-3 hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    <span className="font-medium text-gray-900">{trip.name}</span>
                    <Badge className={tripStatusColor(trip.status)}>{trip.status}</Badge>
                  </div>
                  <span className="text-sm font-medium text-gray-700">{formatCurrency(trip.totalAmount)}</span>
                </CollapsibleTrigger>

                <CollapsibleContent className="border-t border-gray-200 p-3 space-y-2">
                  {trip.expenses.length === 0 ? (
                    <p className="text-sm text-gray-500 py-2">No receipts uploaded yet.</p>
                  ) : trip.expenses.map((expense) => (
                    <div key={expense.id} className="flex items-center justify-between gap-3 py-2 border-b border-gray-100 last:border-0">
                      <div className="flex items-center gap-3 min-w-0">
                        {expense.status === 'PENDING' && (
                          <Checkbox
                            checked={selected.has(expense.id)}
                            onCheckedChange={() => toggleExpenseSelected(trip.id, expense.id)}
                          />
                        )}
                        <a href={expense.receiptUrl} target="_blank" rel="noopener noreferrer" title="View receipt">
                          <ExternalLink className="h-4 w-4 text-gray-400 hover:text-gray-700 flex-shrink-0" />
                        </a>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{expense.description}</p>
                          <p className="text-xs text-gray-500">{formatDate(expense.expenseDate)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-sm font-medium text-gray-900">{formatCurrency(expense.amount)}</span>
                        <Badge className={expenseStatusColor(expense.status)}>{expense.status}</Badge>
                        {expense.status === 'PENDING' && (
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleDeleteExpense(trip.id, expense.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-gray-400 hover:text-red-600" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}

                  <div className="flex items-center justify-between pt-2">
                    <Button variant="outline" size="sm" onClick={() => setUploadDialogTripId(trip.id)}>
                      <Upload className="h-3.5 w-3.5 mr-1" /> Upload Receipt
                    </Button>
                    {pendingExpenses.length > 0 && (
                      <Button
                        size="sm"
                        disabled={selected.size === 0 || invoicingTripId === trip.id}
                        onClick={() => handleCreateInvoice(trip.id)}
                      >
                        {invoicingTripId === trip.id
                          ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                          : <Send className="h-3.5 w-3.5 mr-1" />}
                        Create Invoice ({selected.size} selected)
                      </Button>
                    )}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
      </CardContent>

      {/* New Trip dialog */}
      <Dialog open={newTripDialogOpen} onOpenChange={setNewTripDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Trip</DialogTitle>
            <DialogDescription>Give this trip a name to start uploading receipts to it.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Trip name</Label>
            <Input
              value={newTripName}
              onChange={(e) => setNewTripName(e.target.value)}
              placeholder="e.g. NYC — August 2026"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateTrip()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewTripDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateTrip} disabled={!newTripName.trim() || creatingTrip}>
              {creatingTrip ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Receipt dialog */}
      <Dialog open={!!uploadDialogTripId} onOpenChange={(open) => !open && setUploadDialogTripId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Receipt</DialogTitle>
            <DialogDescription>Add a receipt, its description, and the amount.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Receipt (image or PDF)</Label>
              <Input type="file" accept="image/*,.pdf" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={uploadDescription} onChange={(e) => setUploadDescription(e.target.value)} placeholder="e.g. Flight to NYC" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Amount ($)</Label>
                <Input type="number" step="0.01" min="0" value={uploadAmount} onChange={(e) => setUploadAmount(e.target.value)} placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={uploadDate} onChange={(e) => setUploadDate(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogTripId(null)}>Cancel</Button>
            <Button
              onClick={handleUploadReceipt}
              disabled={!uploadFile || !uploadDescription.trim() || !uploadAmount || uploading}
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Upload'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}