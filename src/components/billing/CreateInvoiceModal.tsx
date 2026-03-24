'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Loader2 } from 'lucide-react';

interface Client {
  id: string;
  name: string;
  companyName: string | null;
  email: string;
  monthlyDeliverables?: Array<{
    id: string;
    type: string;
    quantity: number;
    description?: string;
  }>;
}

interface LineItem {
  description: string;
  amount: string;
  quantity: string;
}

interface CreateInvoiceModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  preselectedClientId?: string; // Optional: pre-select a client
}

export function CreateInvoiceModal({ open, onClose, onSuccess, preselectedClientId }: CreateInvoiceModalProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingDeliverables, setLoadingDeliverables] = useState(false);

  const [selectedClientId, setSelectedClientId] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [sendImmediately, setSendImmediately] = useState(false);
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: '', amount: '', quantity: '1' },
  ]);

  useEffect(() => {
    if (open) {
      loadClients();
      // Set default due date to 30 days from now
      const defaultDue = new Date();
      defaultDue.setDate(defaultDue.getDate() + 30);
      setDueDate(defaultDue.toISOString().split('T')[0]);
      
      // Pre-select client if provided
      if (preselectedClientId) {
        setSelectedClientId(preselectedClientId);
      }
    }
  }, [open, preselectedClientId]);

  // Fetch deliverables when client is selected
  useEffect(() => {
    if (selectedClientId) {
      fetchClientDeliverables(selectedClientId);
    }
  }, [selectedClientId]);

  async function loadClients() {
    try {
      setLoading(true);
      const res = await fetch('/api/clients?status=active');
      const data = await res.json();
      if (data.clients) {
        setClients(data.clients);
      }
    } catch (error) {
      console.error('Failed to load clients:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchClientDeliverables(clientId: string) {
    try {
      setLoadingDeliverables(true);
      const res = await fetch(`/api/clients/${clientId}`);
      const data = await res.json();
      
      if (data.client?.monthlyDeliverables && data.client.monthlyDeliverables.length > 0) {
        // Pre-populate line items from deliverables
        const deliverableItems = data.client.monthlyDeliverables.map((d: any) => ({
          description: `${d.type} (${d.quantity}/month)`,
          amount: '', // Admin needs to fill in the price
          quantity: '1',
        }));
        setLineItems(deliverableItems);
        
        // Set default description
        const clientName = data.client.companyName || data.client.name;
        const currentMonth = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        setDescription(`${currentMonth} Services for ${clientName}`);
      } else {
        // Reset to default if no deliverables
        setLineItems([{ description: '', amount: '', quantity: '1' }]);
      }
    } catch (error) {
      console.error('Failed to fetch client deliverables:', error);
    } finally {
      setLoadingDeliverables(false);
    }
  }

  function addLineItem() {
    setLineItems([...lineItems, { description: '', amount: '', quantity: '1' }]);
  }

  function removeLineItem(index: number) {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index));
    }
  }

  function updateLineItem(index: number, field: keyof LineItem, value: string) {
    const updated = [...lineItems];
    updated[index][field] = value;
    setLineItems(updated);
  }

  function calculateTotal(): number {
    return lineItems.reduce((sum, item) => {
      const amount = parseFloat(item.amount) || 0;
      const quantity = parseInt(item.quantity) || 1;
      return sum + amount * quantity;
    }, 0);
  }

  async function handleSubmit() {
    if (!selectedClientId) {
      alert('Please select a client');
      return;
    }

    const validLineItems = lineItems.filter(
      (item) => item.description && parseFloat(item.amount) > 0
    );

    if (validLineItems.length === 0) {
      alert('Please add at least one line item');
      return;
    }

    try {
      setSubmitting(true);

      const res = await fetch('/api/billing/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: selectedClientId,
          lineItems: validLineItems.map((item) => ({
            description: item.description,
            amount: parseFloat(item.amount),
            quantity: parseInt(item.quantity) || 1,
          })),
          description,
          notes,
          dueDate,
          sendImmediately,
        }),
      });

      const data = await res.json();

      if (data.ok) {
        // Reset form
        setSelectedClientId('');
        setDescription('');
        setNotes('');
        setLineItems([{ description: '', amount: '', quantity: '1' }]);
        setSendImmediately(false);
        onSuccess();
      } else {
        alert(data.message || 'Failed to create invoice');
      }
    } catch (error) {
      console.error('Failed to create invoice:', error);
      alert('Failed to create invoice');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Invoice</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Client Selection */}
          <div className="space-y-2">
            <Label>Client *</Label>
            <Select value={selectedClientId} onValueChange={setSelectedClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.companyName || client.name} ({client.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {loadingDeliverables && (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading client deliverables...
              </p>
            )}
            {selectedClientId && !loadingDeliverables && lineItems.length > 1 && (
              <p className="text-sm text-green-600">
                ✓ Pre-populated {lineItems.length} line items from client deliverables. Add prices below.
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Invoice Description</Label>
            <Input
              placeholder="e.g., March 2024 Services"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Due Date */}
          <div className="space-y-2">
            <Label>Due Date *</Label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          {/* Line Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Line Items *</Label>
              <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                <Plus className="h-4 w-4 mr-1" />
                Add Item
              </Button>
            </div>

            <div className="space-y-3">
              {lineItems.map((item, index) => (
                <div key={index} className="flex gap-3 items-start">
                  <div className="flex-1">
                    <Input
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                    />
                  </div>
                  <div className="w-28">
                    <Input
                      type="number"
                      placeholder="Amount"
                      value={item.amount}
                      onChange={(e) => updateLineItem(index, 'amount', e.target.value)}
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div className="w-20">
                    <Input
                      type="number"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) => updateLineItem(index, 'quantity', e.target.value)}
                      min="1"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeLineItem(index)}
                    disabled={lineItems.length === 1}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="flex justify-end pt-2 border-t">
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-semibold">
                  ${calculateTotal().toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes (visible on invoice)</Label>
            <Textarea
              placeholder="Any additional notes for the client..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Send Immediately */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="sendImmediately"
              checked={sendImmediately}
              onChange={(e) => setSendImmediately(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="sendImmediately" className="font-normal cursor-pointer">
              Send invoice immediately after creating
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : sendImmediately ? (
              'Create & Send'
            ) : (
              'Create Draft'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}