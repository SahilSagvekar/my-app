'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { Checkbox } from '../ui/checkbox';
import { Separator } from '../ui/separator';
import {
  FileText,
  Plus,
  Send,
  Eye,
  Download,
  Trash2,
  RefreshCw,
  DollarSign,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  FileSignature,
  Receipt,
  Loader2,
  ExternalLink,
  Upload,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

// Types
interface Contract {
  id: string;
  title: string;
  status: 'DRAFT' | 'SENT' | 'PARTIALLY_SIGNED' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';
  createdAt: string;
  signers: {
    id: string;
    name: string;
    email: string;
    status: 'PENDING' | 'VIEWED' | 'SIGNED' | 'DECLINED';
    signedAt?: string;
  }[];
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  status: 'DRAFT' | 'PENDING' | 'SENT' | 'PAID' | 'PARTIALLY_PAID' | 'OVERDUE' | 'CANCELED';
  amount: number;
  amountPaid: number;
  currency: string;
  dueDate: string | null;
  description: string | null;
  lineItems: { description: string; amount: number; quantity: number }[];
  createdAt: string;
  sentAt: string | null;
  paidAt: string | null;
  stripeHostedInvoiceUrl: string | null;
  stripePdfUrl: string | null;
}

interface MonthlyDeliverable {
  id: string;
  type: string;
  quantity: number;
  description?: string;
}

interface ClientContractsInvoicesProps {
  clientId: string;
  clientName: string;
  clientEmail: string;
  companyName?: string;
  deliverables: MonthlyDeliverable[];
}

// Status badge helper
const getContractStatusBadge = (status: Contract['status']) => {
  const statusConfig = {
    DRAFT: { label: 'Draft', variant: 'secondary' as const, icon: FileText },
    SENT: { label: 'Sent', variant: 'default' as const, icon: Send },
    PARTIALLY_SIGNED: { label: 'Partially Signed', variant: 'warning' as const, icon: Clock },
    COMPLETED: { label: 'Completed', variant: 'success' as const, icon: CheckCircle },
    CANCELLED: { label: 'Cancelled', variant: 'destructive' as const, icon: XCircle },
    EXPIRED: { label: 'Expired', variant: 'destructive' as const, icon: AlertCircle },
  };
  const config = statusConfig[status] || statusConfig.DRAFT;
  const Icon = config.icon;
  return (
    <Badge variant={config.variant} className="gap-1">
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
};

const getInvoiceStatusBadge = (status: Invoice['status']) => {
  const statusConfig = {
    DRAFT: { label: 'Draft', className: 'bg-gray-100 text-gray-700' },
    PENDING: { label: 'Pending', className: 'bg-yellow-100 text-yellow-700' },
    SENT: { label: 'Sent', className: 'bg-blue-100 text-blue-700' },
    PAID: { label: 'Paid', className: 'bg-green-100 text-green-700' },
    PARTIALLY_PAID: { label: 'Partial', className: 'bg-orange-100 text-orange-700' },
    OVERDUE: { label: 'Overdue', className: 'bg-red-100 text-red-700' },
    CANCELED: { label: 'Canceled', className: 'bg-gray-100 text-gray-500' },
  };
  const config = statusConfig[status] || statusConfig.DRAFT;
  return <Badge className={config.className}>{config.label}</Badge>;
};

// Format currency
const formatCurrency = (cents: number, currency = 'usd') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100);
};

export function ClientContractsInvoices({
  clientId,
  clientName,
  clientEmail,
  companyName,
  deliverables,
}: ClientContractsInvoicesProps) {
  // Contracts state
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loadingContracts, setLoadingContracts] = useState(false);

  // Upload completed contract state
  const [showUploadContract, setShowUploadContract] = useState(false);
  const [uploadingContract, setUploadingContract] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadSignedDate, setUploadSignedDate] = useState(new Date().toISOString().split('T')[0]);
  const [uploadSigners, setUploadSigners] = useState<{ name: string; email: string }[]>([
    { name: '', email: '' },
  ]);
  const [dragOver, setDragOver] = useState(false);

  // Invoices state
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  // Create invoice dialog state
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [newInvoice, setNewInvoice] = useState<{
    dueDate: string;
    description: string;
    notes: string;
    lineItems: { description: string; amount: string; quantity: number; selected: boolean }[];
    sendImmediately: boolean;
  }>({
    dueDate: '',
    description: '',
    notes: '',
    lineItems: [],
    sendImmediately: false,
  });

  // Fetch contracts for this client
  const fetchContracts = useCallback(async () => {
    if (!clientId) return;
    setLoadingContracts(true);
    try {
      const res = await fetch(`/api/contracts?clientId=${clientId}`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (data.ok) {
        setContracts(data.contracts || []);
      }
    } catch (error) {
      console.error('Error fetching contracts:', error);
    } finally {
      setLoadingContracts(false);
    }
  }, [clientId]);

  // Fetch invoices for this client
  const fetchInvoices = useCallback(async () => {
    if (!clientId) return;
    setLoadingInvoices(true);
    try {
      const res = await fetch(`/api/billing/invoices?clientId=${clientId}`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (data.ok) {
        setInvoices(data.invoices || []);
      }
    } catch (error) {
      console.error('Error fetching invoices:', error);
    } finally {
      setLoadingInvoices(false);
    }
  }, [clientId]);

  // Load data when clientId changes
  useEffect(() => {
    if (clientId) {
      fetchContracts();
      fetchInvoices();
    }
  }, [clientId, fetchContracts, fetchInvoices]);

  // Initialize line items from deliverables when opening create dialog
  const handleOpenCreateInvoice = () => {
    // Set default due date to 30 days from now
    const defaultDueDate = new Date();
    defaultDueDate.setDate(defaultDueDate.getDate() + 30);

    // Pre-populate line items from deliverables
    const lineItemsFromDeliverables = deliverables.map((d) => ({
      description: `${d.type} (${d.quantity}/month)`,
      amount: '', // Admin will fill in the price
      quantity: 1,
      selected: true,
    }));

    // Add a default custom line item option
    if (lineItemsFromDeliverables.length === 0) {
      lineItemsFromDeliverables.push({
        description: '',
        amount: '',
        quantity: 1,
        selected: true,
      });
    }

    setNewInvoice({
      dueDate: defaultDueDate.toISOString().split('T')[0],
      description: `Monthly services for ${companyName || clientName}`,
      notes: '',
      lineItems: lineItemsFromDeliverables,
      sendImmediately: false,
    });
    setShowCreateInvoice(true);
  };

  // Add custom line item
  const addLineItem = () => {
    setNewInvoice((prev) => ({
      ...prev,
      lineItems: [
        ...prev.lineItems,
        { description: '', amount: '', quantity: 1, selected: true },
      ],
    }));
  };

  // Remove line item
  const removeLineItem = (index: number) => {
    setNewInvoice((prev) => ({
      ...prev,
      lineItems: prev.lineItems.filter((_, i) => i !== index),
    }));
  };

  // Update line item
  const updateLineItem = (index: number, field: string, value: any) => {
    setNewInvoice((prev) => ({
      ...prev,
      lineItems: prev.lineItems.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  // Calculate total
  const calculateTotal = () => {
    return newInvoice.lineItems
      .filter((item) => item.selected && item.amount)
      .reduce((sum, item) => sum + parseFloat(item.amount || '0') * item.quantity, 0);
  };

  // Create invoice
  const handleCreateInvoice = async () => {
    const selectedItems = newInvoice.lineItems.filter(
      (item) => item.selected && item.description && item.amount
    );

    if (selectedItems.length === 0) {
      toast.error('Please add at least one line item with description and amount');
      return;
    }

    // Validate all selected items have valid amounts > 0
    const invalidItems = selectedItems.filter(item => {
      const amount = parseFloat(item.amount);
      return isNaN(amount) || amount <= 0;
    });

    if (invalidItems.length > 0) {
      toast.error('All line items must have an amount greater than $0');
      return;
    }

    const total = calculateTotal();
    if (total <= 0) {
      toast.error('Invoice total must be greater than $0');
      return;
    }

    setCreatingInvoice(true);
    try {
      const res = await fetch('/api/billing/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          clientId,
          lineItems: selectedItems.map((item) => ({
            description: item.description,
            amount: parseFloat(item.amount),
            quantity: item.quantity,
          })),
          dueDate: newInvoice.dueDate || undefined,
          description: newInvoice.description,
          notes: newInvoice.notes,
          sendImmediately: newInvoice.sendImmediately,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        toast.success(
          newInvoice.sendImmediately
            ? 'Invoice created and sent!'
            : 'Invoice created as draft'
        );
        setShowCreateInvoice(false);
        fetchInvoices();
      } else {
        toast.error(data.message || 'Failed to create invoice');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to create invoice');
    } finally {
      setCreatingInvoice(false);
    }
  };

  // Send invoice
  const handleSendInvoice = async (invoiceId: string) => {
    try {
      const res = await fetch(`/api/billing/invoices/${invoiceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'send' }),
      });

      const data = await res.json();
      if (data.ok) {
        toast.success('Invoice sent to client');
        fetchInvoices();
      } else {
        toast.error(data.message || 'Failed to send invoice');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to send invoice');
    }
  };

  // Send contract
  const handleSendContract = async (contractId: string) => {
    try {
      const res = await fetch(`/api/contracts/${contractId}/send`, {
        method: 'POST',
        credentials: 'include',
      });

      const data = await res.json();
      if (data.ok) {
        toast.success('Contract sent to signers');
        fetchContracts();
      } else {
        toast.error(data.message || 'Failed to send contract');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to send contract');
    }
  };

  // Void invoice
  const handleVoidInvoice = async (invoiceId: string) => {
    if (!confirm('Are you sure you want to void this invoice?')) return;

    try {
      const res = await fetch(`/api/billing/invoices/${invoiceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'void' }),
      });

      const data = await res.json();
      if (data.ok) {
        toast.success('Invoice voided');
        fetchInvoices();
      } else {
        toast.error(data.message || 'Failed to void invoice');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to void invoice');
    }
  };

  // Upload completed contract handlers
  const resetUploadForm = () => {
    setUploadFile(null);
    setUploadTitle('');
    setUploadDescription('');
    setUploadSignedDate(new Date().toISOString().split('T')[0]);
    setUploadSigners([{ name: '', email: '' }]);
  };

  const handleUploadFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f && f.type === 'application/pdf') {
      setUploadFile(f);
    } else {
      toast.error('Please select a PDF file');
    }
  };

  const handleUploadDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f && f.type === 'application/pdf') {
      setUploadFile(f);
    } else {
      toast.error('Please drop a PDF file');
    }
  };

  const addUploadSigner = () => {
    setUploadSigners([...uploadSigners, { name: '', email: '' }]);
  };

  const removeUploadSigner = (index: number) => {
    if (uploadSigners.length > 1) {
      setUploadSigners(uploadSigners.filter((_, i) => i !== index));
    }
  };

  const updateUploadSigner = (index: number, field: 'name' | 'email', value: string) => {
    const updated = [...uploadSigners];
    updated[index] = { ...updated[index], [field]: value };
    setUploadSigners(updated);
  };

  const handleUploadContract = async () => {
    if (!uploadTitle.trim()) {
      toast.error('Title is required');
      return;
    }
    if (!uploadFile) {
      toast.error('Please upload the signed PDF');
      return;
    }

    setUploadingContract(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('title', uploadTitle.trim());
      if (uploadDescription.trim()) formData.append('description', uploadDescription.trim());
      formData.append('clientId', clientId); // Pre-set client
      if (uploadSignedDate) formData.append('signedDate', uploadSignedDate);

      const validSigners = uploadSigners.filter((s) => s.name.trim() && s.email.trim());
      if (validSigners.length > 0) {
        formData.append('signers', JSON.stringify(validSigners.map(s => ({ ...s, role: 'signer' }))));
      }

      const res = await fetch('/api/contracts/upload-completed', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to upload document');
      }

      toast.success('Contract uploaded successfully');
      setShowUploadContract(false);
      resetUploadForm();
      fetchContracts();
    } catch (err: any) {
      toast.error(err.message || 'Something went wrong');
    } finally {
      setUploadingContract(false);
    }
  };

  // Download contract
  const handleDownloadContract = async (contractId: string, type: 'original' | 'signed' = 'signed') => {
    try {
      const res = await fetch(`/api/contracts/${contractId}/download?type=${type}`, {
        credentials: 'include',
      });
      
      if (!res.ok) {
        throw new Error('Failed to download');
      }
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contract-${contractId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error: any) {
      toast.error('Failed to download contract');
    }
  };

  if (!clientId) {
    return (
      <div className="text-center py-8 text-gray-500">
        Save the client first to manage contracts and invoices
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* CONTRACTS SECTION */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <FileSignature className="h-5 w-5 text-indigo-600" />
              Contracts
            </h3>
            <p className="text-sm text-gray-500">
              View and manage contracts for this client
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchContracts}
              disabled={loadingContracts}
            >
              <RefreshCw className={`h-4 w-4 ${loadingContracts ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowUploadContract(true)}
              className="gap-1"
            >
              <Upload className="h-4 w-4" />
              Upload Signed
            </Button>
            <Button
              size="sm"
              onClick={() => window.open('/dashboard?page=contracts', '_blank')}
              className="gap-1"
            >
              <Plus className="h-4 w-4" />
              New Contract
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            {loadingContracts ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : contracts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FileText className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p>No contracts yet</p>
                <p className="text-sm">Upload a signed contract or create a new one</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Signers</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contracts.map((contract) => (
                    <TableRow key={contract.id}>
                      <TableCell className="font-medium">{contract.title}</TableCell>
                      <TableCell>{getContractStatusBadge(contract.status)}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {contract.signers?.map((signer) => (
                            <div key={signer.id} className="text-xs">
                              <span className="font-medium">{signer.name}</span>
                              <span className="text-gray-400 ml-1">
                                ({signer.status.toLowerCase()})
                              </span>
                            </div>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {format(new Date(contract.createdAt), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              window.open(`/contracts/${contract.id}`, '_blank')
                            }
                            title="View"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {contract.status === 'COMPLETED' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownloadContract(contract.id, 'signed')}
                              title="Download"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          )}
                          {contract.status === 'DRAFT' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSendContract(contract.id)}
                              title="Send"
                            >
                              <Send className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* INVOICES SECTION */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Receipt className="h-5 w-5 text-green-600" />
              Invoices
            </h3>
            <p className="text-sm text-gray-500">
              Create and manage invoices based on client deliverables
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchInvoices}
              disabled={loadingInvoices}
            >
              <RefreshCw className={`h-4 w-4 ${loadingInvoices ? 'animate-spin' : ''}`} />
            </Button>
            <Button size="sm" onClick={handleOpenCreateInvoice} className="gap-1">
              <Plus className="h-4 w-4" />
              Create Invoice
            </Button>
          </div>
        </div>

        {/* Deliverables Summary */}
        {deliverables.length > 0 && (
          <Card className="bg-gray-50 border-dashed">
            <CardContent className="p-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                Monthly Deliverables (for invoice reference)
              </h4>
              <div className="flex flex-wrap gap-2">
                {deliverables.map((d) => (
                  <Badge key={d.id} variant="outline" className="bg-white">
                    {d.type}: {d.quantity}/mo
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-0">
            {loadingInvoices ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : invoices.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Receipt className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p>No invoices yet</p>
                <p className="text-sm">Create an invoice to bill this client</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-mono text-sm">
                        {invoice.invoiceNumber}
                      </TableCell>
                      <TableCell>{getInvoiceStatusBadge(invoice.status)}</TableCell>
                      <TableCell>
                        <div>
                          <span className="font-medium">
                            {formatCurrency(invoice.amount, invoice.currency)}
                          </span>
                          {invoice.amountPaid > 0 && invoice.amountPaid < invoice.amount && (
                            <span className="text-xs text-gray-500 block">
                              Paid: {formatCurrency(invoice.amountPaid, invoice.currency)}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {invoice.dueDate
                          ? format(new Date(invoice.dueDate), 'MMM d, yyyy')
                          : '-'}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {format(new Date(invoice.createdAt), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {invoice.stripeHostedInvoiceUrl && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                window.open(invoice.stripeHostedInvoiceUrl!, '_blank')
                              }
                              title="View Invoice"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          )}
                          {invoice.stripePdfUrl && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                window.open(invoice.stripePdfUrl!, '_blank')
                              }
                              title="Download PDF"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          )}
                          {invoice.status === 'DRAFT' && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSendInvoice(invoice.id)}
                                title="Send Invoice"
                              >
                                <Send className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleVoidInvoice(invoice.id)}
                                title="Void Invoice"
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {(invoice.status === 'SENT' || invoice.status === 'PENDING') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleVoidInvoice(invoice.id)}
                              title="Void Invoice"
                              className="text-red-600 hover:text-red-700"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* CREATE INVOICE DIALOG */}
      <Dialog open={showCreateInvoice} onOpenChange={setShowCreateInvoice}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-green-600" />
              Create Invoice for {companyName || clientName}
            </DialogTitle>
            <DialogDescription>
              Create an invoice based on the client's deliverables. Adjust prices and quantities as needed.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Invoice Details */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={newInvoice.dueDate}
                  onChange={(e) =>
                    setNewInvoice((prev) => ({ ...prev, dueDate: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={newInvoice.description}
                  onChange={(e) =>
                    setNewInvoice((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Invoice description"
                />
              </div>
            </div>

            {/* Line Items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Line Items</Label>
                <Button variant="outline" size="sm" onClick={addLineItem} className="gap-1">
                  <Plus className="h-3 w-3" />
                  Add Item
                </Button>
              </div>

              <div className="space-y-2">
                {newInvoice.lineItems.map((item, index) => (
                  <div
                    key={index}
                    className={`flex items-start gap-3 p-3 rounded-lg border ${
                      item.selected ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100'
                    }`}
                  >
                    <Checkbox
                      checked={item.selected}
                      onCheckedChange={(checked) =>
                        updateLineItem(index, 'selected', checked)
                      }
                      className="mt-2"
                    />
                    <div className="flex-1 grid grid-cols-12 gap-2">
                      <div className="col-span-6">
                        <Input
                          placeholder="Description"
                          value={item.description}
                          onChange={(e) =>
                            updateLineItem(index, 'description', e.target.value)
                          }
                          disabled={!item.selected}
                          className="text-sm"
                        />
                      </div>
                      <div className="col-span-3">
                        <div className="relative">
                          <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            type="number"
                            placeholder="0.00"
                            value={item.amount}
                            onChange={(e) =>
                              updateLineItem(index, 'amount', e.target.value)
                            }
                            disabled={!item.selected}
                            className="pl-7 text-sm"
                            step="0.01"
                            min="0"
                          />
                        </div>
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(e) =>
                            updateLineItem(index, 'quantity', parseInt(e.target.value) || 1)
                          }
                          disabled={!item.selected}
                          className="text-sm"
                          min="1"
                        />
                      </div>
                      <div className="col-span-1 flex items-center justify-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeLineItem(index)}
                          className="text-red-500 hover:text-red-700 h-8 w-8 p-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="flex justify-end pt-2 border-t">
                <div className="text-right">
                  <span className="text-sm text-gray-500 mr-2">Total:</span>
                  <span className="text-xl font-bold text-gray-900">
                    ${calculateTotal().toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={newInvoice.notes}
                onChange={(e) =>
                  setNewInvoice((prev) => ({ ...prev, notes: e.target.value }))
                }
                placeholder="Additional notes for the client..."
                rows={3}
              />
            </div>

            {/* Send Immediately */}
            <div className="flex items-center space-x-2 pt-2">
              <Checkbox
                id="sendImmediately"
                checked={newInvoice.sendImmediately}
                onCheckedChange={(checked) =>
                  setNewInvoice((prev) => ({
                    ...prev,
                    sendImmediately: checked as boolean,
                  }))
                }
              />
              <Label htmlFor="sendImmediately" className="text-sm font-normal">
                Send invoice to client immediately via email
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateInvoice(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateInvoice} disabled={creatingInvoice} className="gap-2">
              {creatingInvoice ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Receipt className="h-4 w-4" />
                  {newInvoice.sendImmediately ? 'Create & Send' : 'Create Draft'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Completed Contract Dialog */}
      <Dialog open={showUploadContract} onOpenChange={(open) => {
        setShowUploadContract(open);
        if (!open) resetUploadForm();
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Upload Signed Contract
            </DialogTitle>
            <DialogDescription>
              Upload an already-signed contract for {companyName || clientName}. 
              The client will be able to view this contract in their dashboard.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            {/* Title */}
            <div className="space-y-2">
              <Label>Document Title *</Label>
              <Input
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder="e.g., Service Agreement - March 2024"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={uploadDescription}
                onChange={(e) => setUploadDescription(e.target.value)}
                placeholder="Brief description of this contract..."
                rows={2}
              />
            </div>

            {/* File Upload */}
            <div className="space-y-2">
              <Label>Signed PDF *</Label>
              <div
                className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
                  dragOver
                    ? 'border-green-400 bg-green-50'
                    : uploadFile
                    ? 'border-green-300 bg-green-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleUploadDrop}
              >
                {uploadFile ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileText className="h-8 w-8 text-green-500" />
                    <div className="text-left">
                      <p className="font-semibold text-gray-900 text-sm">{uploadFile.name}</p>
                      <p className="text-xs text-gray-500">
                        {(uploadFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setUploadFile(null)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <Upload className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">
                      Drag & drop the signed PDF here, or{' '}
                      <label className="text-indigo-600 cursor-pointer hover:underline">
                        browse
                        <input
                          type="file"
                          accept=".pdf"
                          onChange={handleUploadFileChange}
                          className="hidden"
                        />
                      </label>
                    </p>
                    <p className="text-xs text-gray-400 mt-1">PDF files only</p>
                  </>
                )}
              </div>
            </div>

            {/* Signed Date */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-gray-400" />
                Date Signed
              </Label>
              <Input
                type="date"
                value={uploadSignedDate}
                onChange={(e) => setUploadSignedDate(e.target.value)}
              />
            </div>

            {/* Signers */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Signers (for records)</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={addUploadSigner}
                  className="text-indigo-600 hover:text-indigo-700"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Signer
                </Button>
              </div>
              <div className="space-y-2">
                {uploadSigners.map((signer, index) => (
                  <div key={index} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                    <Input
                      value={signer.name}
                      onChange={(e) => updateUploadSigner(index, 'name', e.target.value)}
                      placeholder="Full name"
                      className="flex-1"
                    />
                    <Input
                      value={signer.email}
                      onChange={(e) => updateUploadSigner(index, 'email', e.target.value)}
                      placeholder="Email address"
                      className="flex-1"
                    />
                    {uploadSigners.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeUploadSigner(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400">
                Client: {companyName || clientName} ({clientEmail})
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadContract(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUploadContract}
              disabled={uploadingContract}
              className="gap-2 bg-green-600 hover:bg-green-700"
            >
              {uploadingContract ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Upload Contract
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}