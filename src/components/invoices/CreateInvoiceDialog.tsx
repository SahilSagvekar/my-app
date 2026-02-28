'use client';

import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogTrigger,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Loader, Send, Save, AlertCircle } from 'lucide-react';

interface CreateInvoiceDialogProps {
    taskId: string;
    clientId: string;
    clientName: string;
    taskTitle: string;
    trigger?: React.ReactNode;
    onInvoiceCreated?: () => void;
}

export function CreateInvoiceDialog({
    taskId,
    clientId,
    clientName,
    taskTitle,
    trigger,
    onInvoiceCreated,
}: CreateInvoiceDialogProps) {
    const [open, setOpen] = useState(false);
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [saving, setSaving] = useState(false);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [qbConnected, setQbConnected] = useState(false);

    useEffect(() => {
        if (open) {
            setDescription(taskTitle || '');
            setError(null);
            // Set default due date to 30 days from now
            const defaultDue = new Date();
            defaultDue.setDate(defaultDue.getDate() + 30);
            setDueDate(defaultDue.toISOString().split('T')[0]);

            // Check QB status
            fetch('/api/quickbooks/status')
                .then(r => r.json())
                .then(d => setQbConnected(d.connected))
                .catch(() => setQbConnected(false));
        }
    }, [open, taskTitle]);

    async function handleSaveDraft() {
        if (!amount || !description) {
            setError('Amount and description are required');
            return;
        }

        setSaving(true);
        setError(null);

        try {
            const res = await fetch('/api/invoices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    taskId,
                    clientId,
                    amount: parseFloat(amount),
                    description,
                    dueDate: dueDate || null,
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to create invoice');
            }

            setOpen(false);
            resetForm();
            onInvoiceCreated?.();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    }

    async function handleCreateAndSend() {
        if (!amount || !description) {
            setError('Amount and description are required');
            return;
        }

        setSending(true);
        setError(null);

        try {
            // 1. Create the invoice
            const createRes = await fetch('/api/invoices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    taskId,
                    clientId,
                    amount: parseFloat(amount),
                    description,
                    dueDate: dueDate || null,
                }),
            });

            if (!createRes.ok) {
                const data = await createRes.json();
                throw new Error(data.error || 'Failed to create invoice');
            }

            const invoice = await createRes.json();

            // 2. Send it to QuickBooks
            const sendRes = await fetch(`/api/invoices/${invoice.id}/send`, {
                method: 'POST',
            });

            if (!sendRes.ok) {
                const data = await sendRes.json();
                throw new Error(data.error || 'Invoice created but failed to send via QuickBooks');
            }

            setOpen(false);
            resetForm();
            onInvoiceCreated?.();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSending(false);
        }
    }

    function resetForm() {
        setAmount('');
        setDescription('');
        setDueDate('');
        setError(null);
    }

    const isProcessing = saving || sending;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || <Button size="sm" variant="outline">Create Invoice</Button>}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle>Create Invoice</DialogTitle>
                    <DialogDescription>
                        Bill &quot;{clientName}&quot; for this task
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="invoice-amount">Amount (USD)</Label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                            <Input
                                id="invoice-amount"
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="pl-7"
                                disabled={isProcessing}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="invoice-description">Description</Label>
                        <Input
                            id="invoice-description"
                            placeholder="Service description..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            disabled={isProcessing}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="invoice-due-date">Due Date</Label>
                        <Input
                            id="invoice-due-date"
                            type="date"
                            value={dueDate}
                            onChange={(e) => setDueDate(e.target.value)}
                            disabled={isProcessing}
                        />
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                            <AlertCircle className="h-4 w-4 flex-shrink-0" />
                            {error}
                        </div>
                    )}

                    {!qbConnected && (
                        <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-3 rounded-md">
                            <AlertCircle className="h-4 w-4 flex-shrink-0" />
                            QuickBooks is not connected. You can save drafts but cannot send invoices.
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button
                        variant="outline"
                        onClick={handleSaveDraft}
                        disabled={isProcessing}
                    >
                        {saving ? (
                            <Loader className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                            <Save className="h-4 w-4 mr-2" />
                        )}
                        Save Draft
                    </Button>
                    <Button
                        onClick={handleCreateAndSend}
                        disabled={isProcessing || !qbConnected}
                    >
                        {sending ? (
                            <Loader className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                            <Send className="h-4 w-4 mr-2" />
                        )}
                        Create &amp; Send
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
