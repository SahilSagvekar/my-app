import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Calendar } from '../ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { VisuallyHidden } from '../ui/visually-hidden';
import { 
  DollarSign, 
  Receipt, 
  Users, 
  TrendingUp, 
  Plus,
  Search,
  Filter,
  Download,
  Send,
  CheckCircle,
  Clock,
  AlertCircle,
  Calendar as CalendarIcon,
  Edit,
  Eye,
  MoreHorizontal
} from 'lucide-react';
import { toast } from 'sonner';
import { Toaster } from '../ui/sonner';

// Types
interface Invoice {
  id: string;
  invoiceNumber: string;
  clientName: string;
  clientId: string;
  amount: number;
  dueDate: string;
  issueDate: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  description: string;
  items: InvoiceItem[];
  paymentDate?: string;
}

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
  monthlyRate: number;
  hireDate: string;
  status: 'active' | 'inactive';
  avatar: string;
  bankDetails?: {
    accountNumber: string;
    routingNumber: string;
    bankName: string;
  };
}

interface PayrollRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  month: string;
  year: number;
  baseSalary: number;
  bonuses: number;
  deductions: number;
  netPay: number;
  status: 'pending' | 'processed' | 'paid';
  payDate?: string;
}

// Mock data
const mockInvoices: Invoice[] = [
  {
    id: 'inv-001',
    invoiceNumber: 'INV-2024-001',
    clientName: 'Acme Corporation',
    clientId: 'client-001',
    amount: 15000,
    dueDate: '2024-08-25',
    issueDate: '2024-08-01',
    status: 'sent',
    description: 'Monthly content creation services',
    items: [
      { id: '1', description: 'Video Production Services', quantity: 5, rate: 2000, amount: 10000 },
      { id: '2', description: 'Social Media Content', quantity: 20, rate: 250, amount: 5000 }
    ]
  },
  {
    id: 'inv-002',
    invoiceNumber: 'INV-2024-002',
    clientName: 'TechStart Inc.',
    clientId: 'client-002',
    amount: 8500,
    dueDate: '2024-08-15',
    issueDate: '2024-07-20',
    status: 'paid',
    description: 'Brand guidelines and website assets',
    paymentDate: '2024-08-12',
    items: [
      { id: '1', description: 'Brand Guidelines Development', quantity: 1, rate: 5000, amount: 5000 },
      { id: '2', description: 'Website Assets Package', quantity: 1, rate: 3500, amount: 3500 }
    ]
  },
  {
    id: 'inv-003',
    invoiceNumber: 'INV-2024-003',
    clientName: 'Fashion Forward',
    clientId: 'client-003',
    amount: 12000,
    dueDate: '2024-08-05',
    issueDate: '2024-07-15',
    status: 'overdue',
    description: 'Q4 marketing campaign assets',
    items: [
      { id: '1', description: 'Photography Sessions', quantity: 3, rate: 2000, amount: 6000 },
      { id: '2', description: 'Graphic Design Work', quantity: 12, rate: 500, amount: 6000 }
    ]
  }
];

const mockEmployees: Employee[] = [
  {
    id: 'emp-001',
    name: 'Sarah Wilson',
    email: 'sarah.wilson@company.com',
    role: 'Senior Editor',
    monthlyRate: 6500,
    hireDate: '2023-03-15',
    status: 'active',
    avatar: 'SW'
  },
  {
    id: 'emp-002',
    name: 'Mike Johnson',
    email: 'mike.johnson@company.com',
    role: 'Video Editor',
    monthlyRate: 5800,
    hireDate: '2023-06-01',
    status: 'active',
    avatar: 'MJ'
  },
  {
    id: 'emp-003',
    name: 'Lisa Davis',
    email: 'lisa.davis@company.com',
    role: 'QC Specialist',
    monthlyRate: 5200,
    hireDate: '2023-01-10',
    status: 'active',
    avatar: 'LD'
  },
  {
    id: 'emp-004',
    name: 'Alex Chen',
    email: 'alex.chen@company.com',
    role: 'Content Scheduler',
    monthlyRate: 4800,
    hireDate: '2023-09-01',
    status: 'active',
    avatar: 'AC'
  },
  {
    id: 'emp-005',
    name: 'Emma White',
    email: 'emma.white@company.com',
    role: 'Project Manager',
    monthlyRate: 7200,
    hireDate: '2022-11-15',
    status: 'active',
    avatar: 'EW'
  }
];

const mockPayroll: PayrollRecord[] = [
  {
    id: 'pay-001',
    employeeId: 'emp-001',
    employeeName: 'Sarah Wilson',
    month: 'August',
    year: 2024,
    baseSalary: 6500,
    bonuses: 500,
    deductions: 150,
    netPay: 6850,
    status: 'paid',
    payDate: '2024-08-01'
  },
  {
    id: 'pay-002',
    employeeId: 'emp-002',
    employeeName: 'Mike Johnson',
    month: 'August',
    year: 2024,
    baseSalary: 5800,
    bonuses: 200,
    deductions: 120,
    netPay: 5880,
    status: 'paid',
    payDate: '2024-08-01'
  },
  {
    id: 'pay-003',
    employeeId: 'emp-003',
    employeeName: 'Lisa Davis',
    month: 'August',
    year: 2024,
    baseSalary: 5200,
    bonuses: 300,
    deductions: 100,
    netPay: 5400,
    status: 'processed'
  }
];

// Helper functions
const getInvoiceStatusColor = (status: string) => {
  switch (status) {
    case 'paid': return 'bg-green-100 text-green-800';
    case 'sent': return 'bg-blue-100 text-blue-800';
    case 'overdue': return 'bg-red-100 text-red-800';
    case 'draft': return 'bg-gray-100 text-gray-800';
    case 'cancelled': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const getPayrollStatusColor = (status: string) => {
  switch (status) {
    case 'paid': return 'bg-green-100 text-green-800';
    case 'processed': return 'bg-blue-100 text-blue-800';
    case 'pending': return 'bg-yellow-100 text-yellow-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: '2-digit' 
  });
};

export function FinanceTab() {
  const [invoices, setInvoices] = useState<Invoice[]>(mockInvoices);
  const [employees, setEmployees] = useState<Employee[]>(mockEmployees);
  const [payroll, setPayroll] = useState<PayrollRecord[]>(mockPayroll);
  
  // UI State
  const [searchTerm, setSearchTerm] = useState('');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState('all');
  const [showNewInvoiceDialog, setShowNewInvoiceDialog] = useState(false);
  const [showNewEmployeeDialog, setShowNewEmployeeDialog] = useState(false);
  const [showPayrollDialog, setShowPayrollDialog] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  // New Invoice Form
  const [newInvoice, setNewInvoice] = useState({
    clientName: '',
    amount: '',
    dueDate: undefined as Date | undefined,
    description: '',
    items: [{ description: '', quantity: 1, rate: 0 }] as Omit<InvoiceItem, 'id' | 'amount'>[]
  });

  // New Employee Form
  const [newEmployee, setNewEmployee] = useState({
    name: '',
    email: '',
    role: '',
    monthlyRate: '',
    hireDate: undefined as Date | undefined
  });

  // New Payroll Form
  const [newPayroll, setNewPayroll] = useState({
    employeeId: '',
    month: '',
    year: new Date().getFullYear(),
    bonuses: 0,
    deductions: 0
  });

  // Calculations
  const totalRevenue = invoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + inv.amount, 0);
  const pendingRevenue = invoices.filter(inv => inv.status === 'sent').reduce((sum, inv) => sum + inv.amount, 0);
  const overdueAmount = invoices.filter(inv => inv.status === 'overdue').reduce((sum, inv) => sum + inv.amount, 0);
  const monthlyPayrollCost = employees.filter(emp => emp.status === 'active').reduce((sum, emp) => sum + emp.monthlyRate, 0);

  // Filtered data
  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = invoice.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = invoiceStatusFilter === 'all' || invoice.status === invoiceStatusFilter;
    return matchesSearch && matchesStatus;
  });

  // Handlers
  const handleCreateInvoice = () => {
    if (!newInvoice.clientName || !newInvoice.amount || !newInvoice.dueDate) {
      toast('❌ Error', { description: 'Please fill in all required fields.' });
      return;
    }

    const invoice: Invoice = {
      id: `inv-${Date.now()}`,
      invoiceNumber: `INV-2024-${String(invoices.length + 1).padStart(3, '0')}`,
      clientName: newInvoice.clientName,
      clientId: `client-${Date.now()}`,
      amount: parseFloat(newInvoice.amount),
      dueDate: newInvoice.dueDate.toISOString().split('T')[0],
      issueDate: new Date().toISOString().split('T')[0],
      status: 'draft',
      description: newInvoice.description,
      items: newInvoice.items.map((item, index) => ({
        id: String(index + 1),
        ...item,
        amount: item.quantity * item.rate
      }))
    };

    setInvoices(prev => [invoice, ...prev]);
    setNewInvoice({
      clientName: '',
      amount: '',
      dueDate: undefined,
      description: '',
      items: [{ description: '', quantity: 1, rate: 0 }]
    });
    setShowNewInvoiceDialog(false);
    toast('✅ Invoice Created', { description: 'New invoice has been created successfully.' });
  };

  const handleAddEmployee = () => {
    if (!newEmployee.name || !newEmployee.email || !newEmployee.monthlyRate || !newEmployee.hireDate) {
      toast('❌ Error', { description: 'Please fill in all required fields.' });
      return;
    }

    const employee: Employee = {
      id: `emp-${Date.now()}`,
      name: newEmployee.name,
      email: newEmployee.email,
      role: newEmployee.role,
      monthlyRate: parseFloat(newEmployee.monthlyRate),
      hireDate: newEmployee.hireDate.toISOString().split('T')[0],
      status: 'active',
      avatar: newEmployee.name.split(' ').map(n => n[0]).join('').toUpperCase()
    };

    setEmployees(prev => [employee, ...prev]);
    setNewEmployee({
      name: '',
      email: '',
      role: '',
      monthlyRate: '',
      hireDate: undefined
    });
    setShowNewEmployeeDialog(false);
    toast('✅ Employee Added', { description: 'New employee has been added successfully.' });
  };

  const handleProcessPayroll = () => {
    if (!newPayroll.employeeId || !newPayroll.month) {
      toast('❌ Error', { description: 'Please select employee and month.' });
      return;
    }

    const employee = employees.find(emp => emp.id === newPayroll.employeeId);
    if (!employee) return;

    const payrollRecord: PayrollRecord = {
      id: `pay-${Date.now()}`,
      employeeId: employee.id,
      employeeName: employee.name,
      month: newPayroll.month,
      year: newPayroll.year,
      baseSalary: employee.monthlyRate,
      bonuses: newPayroll.bonuses,
      deductions: newPayroll.deductions,
      netPay: employee.monthlyRate + newPayroll.bonuses - newPayroll.deductions,
      status: 'pending'
    };

    setPayroll(prev => [payrollRecord, ...prev]);
    setNewPayroll({
      employeeId: '',
      month: '',
      year: new Date().getFullYear(),
      bonuses: 0,
      deductions: 0
    });
    setShowPayrollDialog(false);
    toast('✅ Payroll Processed', { description: 'Payroll record has been created successfully.' });
  };

  const handleUpdateInvoiceStatus = (invoiceId: string, newStatus: Invoice['status']) => {
    setInvoices(prev => prev.map(inv => 
      inv.id === invoiceId 
        ? { ...inv, status: newStatus, paymentDate: newStatus === 'paid' ? new Date().toISOString().split('T')[0] : undefined }
        : inv
    ));
    toast('✅ Status Updated', { description: 'Invoice status has been updated.' });
  };

  const handleUpdatePayrollStatus = (payrollId: string, newStatus: PayrollRecord['status']) => {
    setPayroll(prev => prev.map(pay => 
      pay.id === payrollId 
        ? { ...pay, status: newStatus, payDate: newStatus === 'paid' ? new Date().toISOString().split('T')[0] : undefined }
        : pay
    ));
    toast('✅ Status Updated', { description: 'Payroll status has been updated.' });
  };

  return (
    <>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1>Admin Portal</h1>
          <p className="text-muted-foreground mt-2">
            Manage invoices, employee payroll, and financial tracking
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <p className="text-2xl font-medium text-green-600">{formatCurrency(totalRevenue)}</p>
                </div>
                <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending Revenue</p>
                  <p className="text-2xl font-medium text-blue-600">{formatCurrency(pendingRevenue)}</p>
                </div>
                <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Clock className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Overdue Amount</p>
                  <p className="text-2xl font-medium text-red-600">{formatCurrency(overdueAmount)}</p>
                </div>
                <div className="h-12 w-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <AlertCircle className="h-6 w-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Monthly Payroll</p>
                  <p className="text-2xl font-medium text-purple-600">{formatCurrency(monthlyPayrollCost)}</p>
                </div>
                <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Users className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="invoices" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="employees">Employees</TabsTrigger>
            <TabsTrigger value="payroll">Payroll</TabsTrigger>
          </TabsList>

          {/* Invoices Tab */}
          <TabsContent value="invoices" className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search invoices..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-80"
                  />
                </div>
                <Select value={invoiceStatusFilter} onValueChange={setInvoiceStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Dialog open={showNewInvoiceDialog} onOpenChange={setShowNewInvoiceDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    New Invoice
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl" aria-describedby="new-invoice-description">
                  <DialogHeader>
                    <DialogTitle id="new-invoice-title">Create New Invoice</DialogTitle>
                    <DialogDescription id="new-invoice-description">
                      Fill in the details below to create a new invoice for a client.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">Client Name</label>
                        <Input
                          value={newInvoice.clientName}
                          onChange={(e) => setNewInvoice(prev => ({ ...prev, clientName: e.target.value }))}
                          placeholder="Enter client name"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Amount</label>
                        <Input
                          type="number"
                          value={newInvoice.amount}
                          onChange={(e) => setNewInvoice(prev => ({ ...prev, amount: e.target.value }))}
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Due Date</label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-left">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {newInvoice.dueDate ? newInvoice.dueDate.toLocaleDateString() : 'Pick a date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={newInvoice.dueDate}
                            onSelect={(date) => setNewInvoice(prev => ({ ...prev, dueDate: date }))}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Description</label>
                      <Input
                        value={newInvoice.description}
                        onChange={(e) => setNewInvoice(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Invoice description"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setShowNewInvoiceDialog(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleCreateInvoice}>Create Invoice</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                      <TableCell>{invoice.clientName}</TableCell>
                      <TableCell>{formatCurrency(invoice.amount)}</TableCell>
                      <TableCell>{formatDate(invoice.dueDate)}</TableCell>
                      <TableCell>
                        <Badge className={getInvoiceStatusColor(invoice.status)}>
                          {invoice.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Select value={invoice.status} onValueChange={(value) => handleUpdateInvoiceStatus(invoice.id, value as Invoice['status'])}>
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="draft">Draft</SelectItem>
                              <SelectItem value="sent">Sent</SelectItem>
                              <SelectItem value="paid">Paid</SelectItem>
                              <SelectItem value="overdue">Overdue</SelectItem>
                              <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button size="sm" variant="outline">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* Employees Tab */}
          <TabsContent value="employees" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3>Employee Management</h3>
                <p className="text-sm text-muted-foreground">Manage employee information and monthly rates</p>
              </div>
              <Dialog open={showNewEmployeeDialog} onOpenChange={setShowNewEmployeeDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Employee
                  </Button>
                </DialogTrigger>
                <DialogContent aria-describedby="new-employee-description">
                  <DialogHeader>
                    <DialogTitle id="new-employee-title">Add New Employee</DialogTitle>
                    <DialogDescription id="new-employee-description">
                      Add a new employee to the payroll system with their salary information.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Full Name</label>
                      <Input
                        value={newEmployee.name}
                        onChange={(e) => setNewEmployee(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Enter full name"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Email</label>
                      <Input
                        type="email"
                        value={newEmployee.email}
                        onChange={(e) => setNewEmployee(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="employee@company.com"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Role</label>
                      <Input
                        value={newEmployee.role}
                        onChange={(e) => setNewEmployee(prev => ({ ...prev, role: e.target.value }))}
                        placeholder="Enter job role"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Monthly Rate ($)</label>
                      <Input
                        type="number"
                        value={newEmployee.monthlyRate}
                        onChange={(e) => setNewEmployee(prev => ({ ...prev, monthlyRate: e.target.value }))}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Hire Date</label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-left">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {newEmployee.hireDate ? newEmployee.hireDate.toLocaleDateString() : 'Pick a date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={newEmployee.hireDate}
                            onSelect={(date) => setNewEmployee(prev => ({ ...prev, hireDate: date }))}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setShowNewEmployeeDialog(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleAddEmployee}>Add Employee</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {employees.map((employee) => (
                <Card key={employee.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback>{employee.avatar}</AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-medium">{employee.name}</h3>
                          <p className="text-sm text-muted-foreground">{employee.role}</p>
                        </div>
                      </div>
                      <Badge variant={employee.status === 'active' ? 'default' : 'secondary'}>
                        {employee.status}
                      </Badge>
                    </div>
                    
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-sm">
                        <span>Monthly Rate:</span>
                        <span className="font-medium">{formatCurrency(employee.monthlyRate)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Hire Date:</span>
                        <span>{formatDate(employee.hireDate)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Email:</span>
                        <span className="truncate ml-2">{employee.email}</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1">
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button 
                        size="sm" 
                        className="flex-1"
                        onClick={() => {
                          setSelectedEmployee(employee);
                          setNewPayroll(prev => ({ ...prev, employeeId: employee.id }));
                          setShowPayrollDialog(true);
                        }}
                      >
                        <Receipt className="h-4 w-4 mr-1" />
                        Payroll
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Payroll Tab */}
          <TabsContent value="payroll" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3>Payroll Management</h3>
                <p className="text-sm text-muted-foreground">Process and track employee payroll</p>
              </div>
              <Dialog open={showPayrollDialog} onOpenChange={setShowPayrollDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Process Payroll
                  </Button>
                </DialogTrigger>
                <DialogContent aria-describedby="payroll-dialog-description">
                  <DialogHeader>
                    <DialogTitle id="payroll-dialog-title">Process Employee Payroll</DialogTitle>
                    <DialogDescription id="payroll-dialog-description">
                      Process monthly payroll for an employee including bonuses and deductions.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Employee</label>
                      <Select value={newPayroll.employeeId} onValueChange={(value) => setNewPayroll(prev => ({ ...prev, employeeId: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select employee" />
                        </SelectTrigger>
                        <SelectContent>
                          {employees.filter(emp => emp.status === 'active').map((employee) => (
                            <SelectItem key={employee.id} value={employee.id}>
                              {employee.name} - {formatCurrency(employee.monthlyRate)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">Month</label>
                        <Select value={newPayroll.month} onValueChange={(value) => setNewPayroll(prev => ({ ...prev, month: value }))}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select month" />
                          </SelectTrigger>
                          <SelectContent>
                            {['January', 'February', 'March', 'April', 'May', 'June', 
                              'July', 'August', 'September', 'October', 'November', 'December'].map((month) => (
                              <SelectItem key={month} value={month}>{month}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Year</label>
                        <Input
                          type="number"
                          value={newPayroll.year}
                          onChange={(e) => setNewPayroll(prev => ({ ...prev, year: parseInt(e.target.value) }))}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">Bonuses ($)</label>
                        <Input
                          type="number"
                          value={newPayroll.bonuses}
                          onChange={(e) => setNewPayroll(prev => ({ ...prev, bonuses: parseFloat(e.target.value) || 0 }))}
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Deductions ($)</label>
                        <Input
                          type="number"
                          value={newPayroll.deductions}
                          onChange={(e) => setNewPayroll(prev => ({ ...prev, deductions: parseFloat(e.target.value) || 0 }))}
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    {newPayroll.employeeId && (
                      <div className="bg-muted p-4 rounded-lg">
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Base Salary:</span>
                            <span>{formatCurrency(employees.find(emp => emp.id === newPayroll.employeeId)?.monthlyRate || 0)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Bonuses:</span>
                            <span className="text-green-600">+{formatCurrency(newPayroll.bonuses)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Deductions:</span>
                            <span className="text-red-600">-{formatCurrency(newPayroll.deductions)}</span>
                          </div>
                          <div className="border-t pt-2 flex justify-between font-medium">
                            <span>Net Pay:</span>
                            <span>{formatCurrency((employees.find(emp => emp.id === newPayroll.employeeId)?.monthlyRate || 0) + newPayroll.bonuses - newPayroll.deductions)}</span>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setShowPayrollDialog(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleProcessPayroll}>Process Payroll</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Base Salary</TableHead>
                    <TableHead>Bonuses</TableHead>
                    <TableHead>Deductions</TableHead>
                    <TableHead>Net Pay</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payroll.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-xs">
                              {employees.find(emp => emp.id === record.employeeId)?.avatar}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{record.employeeName}</span>
                        </div>
                      </TableCell>
                      <TableCell>{record.month} {record.year}</TableCell>
                      <TableCell>{formatCurrency(record.baseSalary)}</TableCell>
                      <TableCell className="text-green-600">{formatCurrency(record.bonuses)}</TableCell>
                      <TableCell className="text-red-600">{formatCurrency(record.deductions)}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(record.netPay)}</TableCell>
                      <TableCell>
                        <Badge className={getPayrollStatusColor(record.status)}>
                          {record.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Select 
                          value={record.status} 
                          onValueChange={(value) => handleUpdatePayrollStatus(record.id, value as PayrollRecord['status'])}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="processed">Processed</SelectItem>
                            <SelectItem value="paid">Paid</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      <Toaster />
    </>
  );
}