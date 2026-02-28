'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '../ui/table';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
    FileText,
    Send,
    Trash2,
    MoreHorizontal,
    RefreshCw,
    Search,
    DollarSign,
    Loader,
    AlertCircle,
} from 'lucide-react';
import { QuickBooksSettings } from '../admin/QuickBooksSettings';

interface Invoice {
    id: string;
    taskId: string;
    clientId: string;
    amount: string;
    description: string;
    status: string;
    dueDate: string | null;
    sentAt: string | null;
    paidAt: string | null;
    qbInvoiceId: string | null;
    qbSyncError: string | null;
    createdAt: string;
    task: { id: string; title: string | null; taskType: string | null };
    client: { id: string; name: string; companyName: string | null; email: string };
}

const STATUS_COLORS: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-700',
    SENT: 'bg-blue-100 text-blue-700',
    PAID: 'bg-green-100 text-green-700',
    VOIDED: 'bg-red-100 text-red-700',
};

export function InvoiceListTab() {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const fetchInvoices = useCallback(async () => {
        try {
            const params = new URLSearchParams();
            if (statusFilter !== 'all') params.set('status', statusFilter);
            const res = await fetch(`/api/invoices?${params}`);
            const data = await res.json();
            setInvoices(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Failed to fetch invoices:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [statusFilter]);

    useEffect(() => {
        fetchInvoices();
    }, [fetchInvoices]);

    async function handleSend(invoiceId: string) {
        if (!confirm('Send this invoice via QuickBooks? The client will receive it by email.')) return;

        setActionLoading(invoiceId);
        try {
            const res = await fetch(`/api/invoices/${invoiceId}/send`, { method: 'POST' });
            if (!res.ok) {
                const data = await res.json();
                alert(data.error || 'Failed to send invoice');
            }
            await fetchInvoices();
        } catch (err) {
            alert('Failed to send invoice');
        } finally {
            setActionLoading(null);
        }
    }

    async function handleVoid(invoiceId: string) {
        if (!confirm('Are you sure you want to void this invoice?')) return;

        setActionLoading(invoiceId);
        try {
            const res = await fetch(`/api/invoices/${invoiceId}`, { method: 'DELETE' });
            if (!res.ok) {
                const data = await res.json();
                alert(data.error || 'Failed to void invoice');
            }
            await fetchInvoices();
        } catch (err) {
            alert('Failed to void invoice');
        } finally {
            setActionLoading(null);
        }
    }

    function handleRefresh() {
        setRefreshing(true);
        fetchInvoices();
    }

    const filteredInvoices = invoices.filter((inv) => {
        if (!search) return true;
        const s = search.toLowerCase();
        return (
            inv.description.toLowerCase().includes(s) ||
            inv.client.name.toLowerCase().includes(s) ||
            (inv.client.companyName || '').toLowerCase().includes(s) ||
            (inv.task.title || '').toLowerCase().includes(s)
        );
    });

    const totals = {
        draft: invoices.filter(i => i.status === 'DRAFT').reduce((sum, i) => sum + parseFloat(i.amount), 0),
        sent: invoices.filter(i => i.status === 'SENT').reduce((sum, i) => sum + parseFloat(i.amount), 0),
        paid: invoices.filter(i => i.status === 'PAID').reduce((sum, i) => sum + parseFloat(i.amount), 0),
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* QBO Connection Card */}
            <QuickBooksSettings />

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="p-2 bg-gray-100 rounded-lg">
                            <FileText className="h-5 w-5 text-gray-600" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Drafts</p>
                            <p className="text-lg font-bold">${totals.draft.toFixed(2)}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <Send className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Outstanding</p>
                            <p className="text-lg font-bold">${totals.sent.toFixed(2)}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                            <DollarSign className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Collected</p>
                            <p className="text-lg font-bold">${totals.paid.toFixed(2)}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters + Table */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <CardTitle className="text-lg">Invoices</CardTitle>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <div className="relative flex-1 sm:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search invoices..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-[130px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Status</SelectItem>
                                    <SelectItem value="DRAFT">Draft</SelectItem>
                                    <SelectItem value="SENT">Sent</SelectItem>
                                    <SelectItem value="PAID">Paid</SelectItem>
                                    <SelectItem value="VOIDED">Voided</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button variant="outline" size="icon" onClick={handleRefresh} disabled={refreshing}>
                                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {filteredInvoices.length === 0 ? (
                        <div className="text-center py-12">
                            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                            <p className="text-muted-foreground">No invoices found</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                Create invoices from the Task Management page
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Client</TableHead>
                                        <TableHead>Task</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead className="text-right">Amount</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Due Date</TableHead>
                                        <TableHead className="w-[50px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredInvoices.map((inv) => (
                                        <TableRow key={inv.id}>
                                            <TableCell className="font-medium">
                                                {inv.client.companyName || inv.client.name}
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                                                {inv.task.title || inv.taskId}
                                            </TableCell>
                                            <TableCell className="text-sm max-w-[200px] truncate">
                                                {inv.description}
                                            </TableCell>
                                            <TableCell className="text-right font-medium">
                                                ${parseFloat(inv.amount).toFixed(2)}
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={STATUS_COLORS[inv.status] || ''} variant="secondary">
                                                    {inv.status}
                                                </Badge>
                                                {inv.qbSyncError && (
                                                    <span className="ml-1" title={inv.qbSyncError}>
                                                        <AlertCircle className="h-3 w-3 text-destructive inline" />
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {inv.dueDate
                                                    ? new Date(inv.dueDate).toLocaleDateString()
                                                    : '—'}
                                            </TableCell>
                                            <TableCell>
                                                {actionLoading === inv.id ? (
                                                    <Loader className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                                <MoreHorizontal className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            {inv.status === 'DRAFT' && (
                                                                <DropdownMenuItem onClick={() => handleSend(inv.id)}>
                                                                    <Send className="h-4 w-4 mr-2" />
                                                                    Send via QuickBooks
                                                                </DropdownMenuItem>
                                                            )}
                                                            {['DRAFT', 'SENT'].includes(inv.status) && (
                                                                <DropdownMenuItem
                                                                    onClick={() => handleVoid(inv.id)}
                                                                    className="text-destructive"
                                                                >
                                                                    <Trash2 className="h-4 w-4 mr-2" />
                                                                    {inv.status === 'DRAFT' ? 'Delete' : 'Void'}
                                                                </DropdownMenuItem>
                                                            )}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
