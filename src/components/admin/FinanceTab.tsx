"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { SimpleCalendar } from "../ui/simple-calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Calendar } from "../ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../ui/popover";
import {
  DollarSign,
  Users,
  Plus,
  Search,
  Clock,
  AlertCircle,
  Calendar as CalendarIcon,
  Edit,
  Eye,
  Receipt,
  Gift,
} from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "../ui/sonner";

// ---------- Types ----------

interface Invoice {
  id: string;
  invoiceNumber: string;
  clientName: string;
  clientId: string;
  amount: number;
  dueDate: string;
  issueDate: string;
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
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
  id: number;
  name: string;
  email: string;
  role: string;
  hourlyRate: number;
  hoursPerWeek: number;
  monthlyRate: number;
  hireDate: string;
  status: "active" | "inactive" | "terminated";
  avatar: string;
  worksOnSaturday: boolean;
}

interface PayrollRecord {
  id: number;
  employeeId: number;
  employeeName: string;
  month: string;
  year: number;
  baseSalary: number;
  bonuses: number;
  deductions: number;
  netPay: number;
  status: "pending" | "paid";
  payDate?: string;
  // periodStart: Date;
  // periodEnd: Date;
}

// ---------- Mock invoices only ----------

const mockInvoices: Invoice[] = [
  {
    id: "inv-001",
    invoiceNumber: "INV-2024-001",
    clientName: "Acme Corporation",
    clientId: "client-001",
    amount: 15000,
    dueDate: "2024-08-25",
    issueDate: "2024-08-01",
    status: "sent",
    description: "Monthly content creation services",
    items: [
      {
        id: "1",
        description: "Video Production Services",
        quantity: 5,
        rate: 2000,
        amount: 10000,
      },
      {
        id: "2",
        description: "Social Media Content",
        quantity: 20,
        rate: 250,
        amount: 5000,
      },
    ],
  },
  {
    id: "inv-002",
    invoiceNumber: "INV-2024-002",
    clientName: "TechStart Inc.",
    clientId: "client-002",
    amount: 8500,
    dueDate: "2024-08-15",
    issueDate: "2024-07-20",
    status: "paid",
    description: "Brand guidelines and website assets",
    paymentDate: "2024-08-12",
    items: [
      {
        id: "1",
        description: "Brand Guidelines Development",
        quantity: 1,
        rate: 5000,
        amount: 5000,
      },
      {
        id: "2",
        description: "Website Assets Package",
        quantity: 1,
        rate: 3500,
        amount: 3500,
      },
    ],
  },
  {
    id: "inv-003",
    invoiceNumber: "INV-2024-003",
    clientName: "Fashion Forward",
    clientId: "client-003",
    amount: 12000,
    dueDate: "2024-08-05",
    issueDate: "2024-07-15",
    status: "overdue",
    description: "Q4 marketing campaign assets",
    items: [
      {
        id: "1",
        description: "Photography Sessions",
        quantity: 3,
        rate: 2000,
        amount: 6000,
      },
      {
        id: "2",
        description: "Graphic Design Work",
        quantity: 12,
        rate: 500,
        amount: 6000,
      },
    ],
  },
];

// ---------- Helpers ----------

const getInvoiceStatusColor = (status: string) => {
  switch (status) {
    case "paid":
      return "bg-green-100 text-green-800";
    case "sent":
      return "bg-blue-100 text-blue-800";
    case "overdue":
      return "bg-red-100 text-red-800";
    case "draft":
      return "bg-gray-100 text-gray-800";
    case "cancelled":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

const getPayrollStatusColor = (status: PayrollRecord["status"]) => {
  switch (status) {
    case "paid":
      return "bg-green-100 text-green-800";
    case "pending":
      return "bg-yellow-100 text-yellow-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

const getEmployeeStatusColor = (status: Employee["status"]) => {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-800";
    case "inactive":
      return "bg-yellow-100 text-yellow-800";
    case "terminated":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount || 0);
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
};

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function formatMonthRange(month: number, year: number) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);

  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  };

  const startStr = start.toLocaleDateString("en-US", opts);
  const endStr = end.toLocaleDateString("en-US", opts);

  return `${startStr} – ${endStr}`;
}

// Approx default working days per month (for UI only; backend uses proper logic)
const DEFAULT_WORKING_DAYS = 22;

// Small helper to hit your backend with JWT automatically
async function apiFetch(path: string, options: RequestInit = {}) {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  let data;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const message = (data && data.message) || "Request failed";
    throw new Error(message);
  }

  return data;
}

// ---------- Component ----------

export function FinanceTab() {
  // Backend-connected state
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payroll, setPayroll] = useState<PayrollRecord[]>([]);

  // Invoices remain mock
  const [invoices, setInvoices] = useState<Invoice[]>(mockInvoices);

  // UI state
  const [searchTerm, setSearchTerm] = useState("");
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState("all");
  const [showNewInvoiceDialog, setShowNewInvoiceDialog] = useState(false);
  const [showNewEmployeeDialog, setShowNewEmployeeDialog] = useState(false);
  const [showPayrollDialog, setShowPayrollDialog] = useState(false);

  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [loadingPayroll, setLoadingPayroll] = useState(false);

  // Bonus + hourly modals state
  const [bonusModalOpen, setBonusModalOpen] = useState(false);
  const [hourlyModalOpen, setHourlyModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    null
  );
  const [bonusAmount, setBonusAmount] = useState<string>("");
  const [hourlyRateInput, setHourlyRateInput] = useState<string>("");

  // New Invoice Form (mock only)
  const [newInvoice, setNewInvoice] = useState({
    clientName: "",
    amount: "",
    dueDate: undefined as Date | undefined,
    description: "",
    items: [{ description: "", quantity: 1, rate: 0 }] as Omit<
      InvoiceItem,
      "id" | "amount"
    >[],
  });

  // Payroll generation form – month/year for all employees
  const [newPayroll, setNewPayroll] = useState({
    month: "",
    year: new Date().getFullYear(),
  });

  // Add after existing state
  const [editEmployeeModalOpen, setEditEmployeeModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [editEmployeeForm, setEditEmployeeForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    role: "",
    hourlyRate: "",
    hoursPerWeek: "",
    hireDate: undefined as Date | undefined,
    status: "active" as "active" | "inactive"| "terminated",
  });
  const [newEmployee, setNewEmployee] = useState({
  firstName: "",
  lastName: "",
  email: "",
  role: "",
  hourlyRate: "",
  hoursPerWeek: "", 
  hireDate: undefined as Date | undefined,
  worksOnSaturday: false,
});
  

  const openEditEmployeeModal = (employee: Employee) => {
    const [firstName, ...lastNameParts] = employee.name.split(" ");
    const lastName = lastNameParts.join(" ");

    setEditingEmployee(employee);
    setEditEmployeeForm({
      firstName: firstName || "",
      lastName: lastName || "",
      email: employee.email,
      role: employee.role,
      hourlyRate: String(employee.hourlyRate),
      hoursPerWeek: String(employee.hoursPerWeek || 0),
      hireDate: employee.hireDate ? new Date(employee.hireDate) : undefined,
      status: employee.status,
    });
    setEditEmployeeModalOpen(true);
  };

  const handleAddEmployee = async () => {
  if (
    !newEmployee.firstName ||
    !newEmployee.lastName ||
    !newEmployee.email ||
    !newEmployee.hourlyRate ||
    !newEmployee.hireDate
  ) {
    toast("❌ Error", {
      description: "Please fill in all required fields.",
    });
    return;
  }

  try {
    const hourlyRate = parseFloat(newEmployee.hourlyRate);
    const fullName = `${newEmployee.firstName} ${newEmployee.lastName}`.trim();
    const hoursPerWeek = Number(newEmployee.hoursPerWeek);

    await apiFetch("/api/employee", {
      method: "POST",
      body: JSON.stringify({
        name: fullName,
        email: newEmployee.email,
        role: newEmployee.role || "editor",
        hourlyRate,
        hoursPerWeek,
        joinedAt: newEmployee.hireDate.toISOString(),
        worksOnSaturday: newEmployee.worksOnSaturday,
      }),
    });

    toast("✅ Employee Added", {
      description: "New employee has been added successfully.",
    });

    setNewEmployee({
      firstName: "",
      lastName: "",
      email: "",
      role: "",
      hourlyRate: "",
      hoursPerWeek: "0",
      hireDate: undefined,
      worksOnSaturday: false,
    });
    setShowNewEmployeeDialog(false);
    await loadEmployees();
  } catch (err: any) {
    console.error(err);
    toast("❌ Error", {
      description: err.message || "Failed to add employee.",
    });
  }
};

  const handleEditEmployee = async () => {
    if (!editingEmployee) return;

    // if (
    //   !editEmployeeForm.firstName ||
    //   !editEmployeeForm.lastName ||
    //   !editEmployeeForm.email ||
    // ) {
    //   toast("❌ Error", {
    //     description: "Please fill in all required fields.",
    //   });
    //   return;
    // }

    try {
      const hourlyRate = parseFloat(editEmployeeForm.hourlyRate);
      // const hoursPerWeek = parseFloat(editEmployeeForm.hoursPerWeek);
      const hoursPerWeek = Number(editEmployeeForm.hoursPerWeek);
      const fullName = `${newEmployee.firstName} ${newEmployee.lastName}`.trim();

      // Map status to database enum
      const statusMap = {
        active: "ACTIVE",
        inactive: "INACTIVE",
        terminated: "TERMINATED",
      };

      await apiFetch(`/api/employee/${editingEmployee.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: fullName,
          email: editEmployeeForm.email,
          role: editEmployeeForm.role,
          hourlyRate,
          hoursPerWeek,
          employeeStatus: statusMap[editEmployeeForm.status],
          joinedAt: editEmployeeForm.hireDate?.toISOString(),
        }),
      });

      toast("✅ Employee Updated", {
        description: "Employee information has been updated successfully.",
      });

      setEditEmployeeModalOpen(false);
      setEditingEmployee(null);
      await loadEmployees();
    } catch (err: any) {
      console.error(err);
      toast("❌ Error", {
        description: err.message || "Failed to update employee.",
      });
    }
  };
  // ---------- Backend fetches ----------

  const loadEmployees = async () => {
    try {
      setLoadingEmployees(true);
      const data = await apiFetch("/api/employee/list", {
        method: "GET",
      });

      const mapped: Employee[] =
        data?.employees?.map((u: any) => {
          const name = u.name || u.email || "Unnamed";
          const avatar =
            name
              .split(" ")
              .map((n: string) => n[0])
              .join("")
              .toUpperCase() || "U";

          const hourly = u.hourlyRate ? Number(u.hourlyRate) : 0;
          const hoursPerWeek = u.hoursPerWeek ? Number(u.hoursPerWeek) : 40; // Default to 40
          const monthlyRate = hourly * hoursPerWeek * 4; // Updated calculation

          return {
            id: u.id,
            name,
            email: u.email,
            role: u.role,
            hourlyRate: hourly,
            hoursPerWeek,
            monthlyRate, // Now correctly calculated
            hireDate: u.joinedAt || u.createdAt,
            status:
              u.employeeStatus === "ACTIVE"
                ? "active"
                : u.employeeStatus === "TERMINATED"
                ? "terminated"
                : "inactive",
            avatar,
            worksOnSaturday: !!u.worksOnSaturday,
          };
        }) ?? [];

      setEmployees(mapped);
    } catch (err: any) {
      console.error("Failed to load employees", err);
      toast("Error loading employees", {
        description: err.message,
      });
    } finally {
      setLoadingEmployees(false);
    }
  };

  const loadPayroll = async () => {
    try {
      setLoadingPayroll(true);
      const data = await apiFetch("/api/payroll/list", { method: "GET" });

      // const mapped: PayrollRecord[] =
      //   data?.payrolls?.map((p: any) => {
      //     const periodStart = new Date(p.periodStart);
      //     const monthName = monthNames[periodStart.getUTCMonth()] || "-";
      //     const year = periodStart.getUTCFullYear();

      //     const employeeName = p.employee?.name || `Employee #${p.employeeId}`;

      //     return {
      //       id: p.id,
      //       employeeId: p.employeeId,
      //       employeeName,
      //       month: monthName,
      //       year,
      //       baseSalary: Number(p.baseSalary),
      //       bonuses: Number(p.totalBonuses),
      //       deductions: Number(p.totalDeductions),
      //       netPay: Number(p.netPay),
      //       status: p.status === "PAID" ? "paid" : "pending",
      //       payDate: p.paidAt || undefined,
      //     };
      //   }) ?? [];

      const mapped = data?.payrolls?.map((p: any) => {
        return {
          id: p.id,
          employeeId: p.employeeId,
          employeeName: p.employee?.name || `Employee #${p.employeeId}`,
          month: p.periodStart ? new Date(p.periodStart).getMonth() + 1 : null,
          year: p.periodStart ? new Date(p.periodStart).getFullYear() : null,
          periodStart: p.periodStart,
          periodEnd: p.periodEnd,
          baseSalary: Number(p.baseSalary),
          bonuses: Number(p.totalBonuses),
          deductions: Number(p.totalDeductions),
          netPay: Number(p.netPay),
          status: p.status === "PAID" ? "paid" : "pending",
          payDate: p.paidAt || undefined,
        };
      });

      setPayroll(mapped);
    } catch (err: any) {
      console.error("Failed to load payroll", err);
      toast("Error loading payroll", {
        description: err.message,
      });
    } finally {
      setLoadingPayroll(false);
    }
  };

  useEffect(() => {
    loadEmployees();
    loadPayroll();
  }, []);

  // ---------- Calculations ----------

  const totalRevenue = invoices
    .filter((inv) => inv.status === "paid")
    .reduce((sum, inv) => sum + inv.amount, 0);

  const pendingRevenue = invoices
    .filter((inv) => inv.status === "sent")
    .reduce((sum, inv) => sum + inv.amount, 0);

  const overdueAmount = invoices
    .filter((inv) => inv.status === "overdue")
    .reduce((sum, inv) => sum + inv.amount, 0);

  const monthlyPayrollCost = payroll.reduce(
    (sum, p) => sum + (p.netPay || 0),
    0
  );

  const filteredInvoices = invoices.filter((invoice) => {
    const matchesSearch =
      invoice.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      invoiceStatusFilter === "all" || invoice.status === invoiceStatusFilter;
    return matchesSearch && matchesStatus;
  });

  // ---------- Handlers (Invoices) ----------

  const handleCreateInvoice = () => {
    if (!newInvoice.clientName || !newInvoice.amount || !newInvoice.dueDate) {
      toast("❌ Error", {
        description: "Please fill in all required fields.",
      });
      return;
    }

    const invoice: Invoice = {
      id: `inv-${Date.now()}`,
      invoiceNumber: `INV-${new Date().getFullYear()}-${String(
        invoices.length + 1
      ).padStart(3, "0")}`,
      clientName: newInvoice.clientName,
      clientId: `client-${Date.now()}`,
      amount: parseFloat(newInvoice.amount),
      dueDate: newInvoice.dueDate.toISOString().split("T")[0],
      issueDate: new Date().toISOString().split("T")[0],
      status: "draft",
      description: newInvoice.description,
      items: newInvoice.items.map((item, index) => ({
        id: String(index + 1),
        ...item,
        amount: item.quantity * item.rate,
      })),
    };

    setInvoices((prev) => [invoice, ...prev]);
    setNewInvoice({
      clientName: "",
      amount: "",
      dueDate: undefined,
      description: "",
      items: [{ description: "", quantity: 1, rate: 0 }],
    });
    setShowNewInvoiceDialog(false);
    toast("✅ Invoice Created", {
      description: "New invoice has been created successfully.",
    });
  };

  const handleUpdateInvoiceStatus = (
    invoiceId: string,
    newStatus: Invoice["status"]
  ) => {
    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === invoiceId
          ? {
              ...inv,
              status: newStatus,
              paymentDate:
                newStatus === "paid"
                  ? new Date().toISOString().split("T")[0]
                  : undefined,
            }
          : inv
      )
    );
    toast("✅ Status Updated", {
      description: "Invoice status has been updated.",
    });
  };

  // ---------- Handlers (Employees) ----------


  const openBonusModal = (employee: Employee) => {
    setSelectedEmployee(employee);
    setBonusAmount("");
    setBonusModalOpen(true);
  };

  const openHourlyModal = (employee: Employee) => {
    setSelectedEmployee(employee);
    setHourlyRateInput(
      employee.hourlyRate ? String(employee.hourlyRate.toFixed(2)) : ""
    );
    setHourlyModalOpen(true);
  };

  const handleSaveBonus = async () => {
    if (!selectedEmployee) return;
    const value = parseFloat(bonusAmount);
    if (!value || value <= 0) {
      toast("Invalid bonus amount");
      return;
    }

    try {
      await apiFetch(`/api/employee/${selectedEmployee.id}/bonus`, {
        method: "POST",
        body: JSON.stringify({ amount: value }),
      });

      toast("✅ Bonus added", {
        description: `Bonus of ${formatCurrency(value)} added to ${
          selectedEmployee.name
        }`,
      });

      setBonusModalOpen(false);
      setBonusAmount("");
      // Optionally reload payroll, but not required here
    } catch (err: any) {
      console.error(err);
      toast("❌ Error", {
        description: err.message || "Failed to add bonus.",
      });
    }
  };

  const handleSaveHourlyRate = async () => {
    if (!selectedEmployee) return;
    const value = parseFloat(hourlyRateInput);
    if (!value || value <= 0) {
      toast("Invalid hourly rate");
      return;
    }

    try {
      await apiFetch(`/api/employee/${selectedEmployee.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          hourlyRate: value,
        }),
      });

      toast("✅ Hourly rate updated", {
        description: `${
          selectedEmployee.name
        }'s hourly rate set to ${formatCurrency(value)}/hr`,
      });

      setHourlyModalOpen(false);
      setHourlyRateInput("");
      await loadEmployees();
    } catch (err: any) {
      console.error(err);
      toast("❌ Error", {
        description: err.message || "Failed to update hourly rate.",
      });
    }
  };

  // ---------- Handlers (Payroll) ----------

  const handleProcessPayroll = async () => {
    if (!newPayroll.month || !newPayroll.year) {
      toast("❌ Error", {
        description: "Please select month and year.",
      });
      return;
    }

    const monthIndex = monthNames.indexOf(newPayroll.month);
    if (monthIndex === -1) {
      toast("❌ Error", { description: "Invalid month." });
      return;
    }

    try {
      await apiFetch(
        `/api/payroll/generate/${newPayroll.year}/${monthIndex + 1}`,
        {
          method: "POST",
        }
      );

      toast("✅ Payroll Generated", {
        description: "Payroll has been generated for all active employees.",
      });

      setNewPayroll({
        month: "",
        year: new Date().getFullYear(),
      });
      setShowPayrollDialog(false);
      await loadPayroll();
    } catch (err: any) {
      console.error(err);
      toast("❌ Error", {
        description: err.message || "Failed to generate payroll.",
      });
    }
  };

  const handleUpdatePayrollStatus = async (
    record: PayrollRecord,
    newStatus: PayrollRecord["status"]
  ) => {
    if (newStatus === "paid" && record.status !== "paid") {
      try {
        await apiFetch(`/api/payroll/${record.id}/mark-paid`, {
          method: "PATCH",
        });
        toast("✅ Status Updated", {
          description: "Payroll marked as paid.",
        });
        await loadPayroll();
      } catch (err: any) {
        console.error(err);
        toast("❌ Error", {
          description: err.message || "Failed to update payroll.",
        });
      }
    }
  };

  // ---------- Render ----------

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
                  <p className="text-2xl font-medium text-green-600">
                    {formatCurrency(totalRevenue)}
                  </p>
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
                  <p className="text-sm text-muted-foreground">
                    Pending Revenue
                  </p>
                  <p className="text-2xl font-medium text-blue-600">
                    {formatCurrency(pendingRevenue)}
                  </p>
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
                  <p className="text-sm text-muted-foreground">
                    Overdue Amount
                  </p>
                  <p className="text-2xl font-medium text-red-600">
                    {formatCurrency(overdueAmount)}
                  </p>
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
                  <p className="text-sm text-muted-foreground">
                    Monthly Payroll (Net)
                  </p>
                  <p className="text-2xl font-medium text-purple-600">
                    {formatCurrency(monthlyPayrollCost)}
                  </p>
                </div>
                <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Users className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="employees" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="employees">Employees</TabsTrigger>
            <TabsTrigger value="payroll">Payroll</TabsTrigger>
          </TabsList>

          {/* Invoices Tab (still mock) */}
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
                <Select
                  value={invoiceStatusFilter}
                  onValueChange={setInvoiceStatusFilter}
                >
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
              <Dialog
                open={showNewInvoiceDialog}
                onOpenChange={setShowNewInvoiceDialog}
              >
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    New Invoice
                  </Button>
                </DialogTrigger>
                <DialogContent
                  className="max-w-2xl"
                  aria-describedby="new-invoice-description"
                >
                  <DialogHeader>
                    <DialogTitle id="new-invoice-title">
                      Create New Invoice
                    </DialogTitle>
                    <DialogDescription id="new-invoice-description">
                      Fill in the details below to create a new invoice for a
                      client.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">
                          Client Name
                        </label>
                        <Input
                          value={newInvoice.clientName}
                          onChange={(e) =>
                            setNewInvoice((prev) => ({
                              ...prev,
                              clientName: e.target.value,
                            }))
                          }
                          placeholder="Enter client name"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Amount</label>
                        <Input
                          type="number"
                          value={newInvoice.amount}
                          onChange={(e) =>
                            setNewInvoice((prev) => ({
                              ...prev,
                              amount: e.target.value,
                            }))
                          }
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Due Date</label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-start text-left"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {newInvoice.dueDate
                              ? newInvoice.dueDate.toLocaleDateString()
                              : "Pick a date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={newInvoice.dueDate}
                            onSelect={(date) =>
                              setNewInvoice((prev) => ({
                                ...prev,
                                dueDate: date ?? undefined,
                              }))
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Description</label>
                      <Input
                        value={newInvoice.description}
                        onChange={(e) =>
                          setNewInvoice((prev) => ({
                            ...prev,
                            description: e.target.value,
                          }))
                        }
                        placeholder="Invoice description"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setShowNewInvoiceDialog(false)}
                      >
                        Cancel
                      </Button>
                      <Button onClick={handleCreateInvoice}>
                        Create Invoice
                      </Button>
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
                      <TableCell className="font-medium">
                        {invoice.invoiceNumber}
                      </TableCell>
                      <TableCell>{invoice.clientName}</TableCell>
                      <TableCell>{formatCurrency(invoice.amount)}</TableCell>
                      <TableCell>{formatDate(invoice.dueDate)}</TableCell>
                      <TableCell>
                        <Badge
                          className={getInvoiceStatusColor(invoice.status)}
                        >
                          {invoice.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Select
                            value={invoice.status}
                            onValueChange={(value) =>
                              handleUpdateInvoiceStatus(
                                invoice.id,
                                value as Invoice["status"]
                              )
                            }
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="draft">Draft</SelectItem>
                              <SelectItem value="sent">Sent</SelectItem>
                              <SelectItem value="paid">Paid</SelectItem>
                              <SelectItem value="overdue">Overdue</SelectItem>
                              <SelectItem value="cancelled">
                                Cancelled
                              </SelectItem>
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
                <p className="text-sm text-muted-foreground">
                  Manage employee information and hourly rates
                </p>
              </div>
              <Dialog
                open={showNewEmployeeDialog}
                onOpenChange={setShowNewEmployeeDialog}
              >
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Employee
                  </Button>
                </DialogTrigger>
                <DialogContent aria-describedby="new-employee-description">
                  <DialogHeader>
                    <DialogTitle id="new-employee-title">
                      Add New Employee
                    </DialogTitle>
                    <DialogDescription id="new-employee-description">
                      Add a new employee with their hourly rate. Monthly rate
                      will be calculated automatically.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">
                          First Name
                        </label>
                        <Input
                          value={newEmployee.firstName}
                          onChange={(e) =>
                            setNewEmployee((prev) => ({
                              ...prev,
                              firstName: e.target.value,
                            }))
                          }
                          placeholder="Enter first name"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Last Name</label>
                        <Input
                          value={newEmployee.lastName}
                          onChange={(e) =>
                            setNewEmployee((prev) => ({
                              ...prev,
                              lastName: e.target.value,
                            }))
                          }
                          placeholder="Enter last name"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Email</label>
                      <Input
                        type="email"
                        value={newEmployee.email}
                        onChange={(e) =>
                          setNewEmployee((prev) => ({
                            ...prev,
                            email: e.target.value,
                          }))
                        }
                        placeholder="employee@company.com"
                      />
                    </div>
                    {/* Around line 1280 - Replace the Role input field */}
                    <div>
                      <label className="text-sm font-medium">Role</label>
                      <Select
                        value={newEmployee.role}
                        onValueChange={(value) =>
                          setNewEmployee((prev) => ({
                            ...prev,
                            role: value,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="editor">Editor</SelectItem>
                          <SelectItem value="videographer">
                            Videographer
                          </SelectItem>
                          <SelectItem value="scheduler">Scheduler</SelectItem>
                          <SelectItem value="qc">QC</SelectItem>
                          <SelectItem value="client">Client</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
  <label className="text-sm font-medium">
    Hourly Rate ($)
  </label>
  <Input
    type="number"
    value={newEmployee.hourlyRate}  // ✅ Correct
    onChange={(e) =>
      setNewEmployee((prev) => ({   // ✅ Correct
        ...prev,
        hourlyRate: e.target.value,
      }))
    }
    placeholder="0.00"
  />
</div>

{/* Add this new field */}
<div>
  <label className="text-sm font-medium">
    Hours Per Week
  </label>
  <Input
    type="number"
    value={newEmployee.hoursPerWeek}  // ✅ Correct
    onChange={(e) =>
      setNewEmployee((prev) => ({     // ✅ Correct
        ...prev,
        hoursPerWeek: e.target.value,
      }))
    }
    placeholder="40"
  />
  <p className="text-xs text-muted-foreground mt-1">
    Typical full-time: 40 hours/week
  </p>
</div>

{/* Add preview calculation */}
{newEmployee.hourlyRate &&  // ✅ Correct
  newEmployee.hoursPerWeek && (  // ✅ Correct
    <div className="text-sm bg-muted p-3 rounded-md">
      <p className="font-medium">Monthly Salary Preview:</p>
      <p className="text-lg font-bold text-primary">
        {formatCurrency(
          parseFloat(newEmployee.hourlyRate || "0") *  // ✅ Correct
            parseFloat(newEmployee.hoursPerWeek || "0") *  // ✅ Correct
            4
        )}
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        = ${newEmployee.hourlyRate}/hr ×{" "} 
        {newEmployee.hoursPerWeek} hrs/week × 4 weeks 
      </p>
    </div>
  )}
                    <div>
                      <label className="text-sm font-medium">Hire Date</label>
                      <SimpleCalendar
                        selected={newEmployee.hireDate}
                        onSelect={(date) =>
                          setNewEmployee((prev) => ({
                            ...prev,
                            hireDate: date,
                          }))
                        }
                        placeholder="Select hire date"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="worksOnSaturday"
                        checked={newEmployee.worksOnSaturday}
                        onChange={(e) =>
                          setNewEmployee((prev) => ({
                            ...prev,
                            worksOnSaturday: e.target.checked,
                          }))
                        }
                      />
                      <label
                        htmlFor="worksOnSaturday"
                        className="text-sm font-medium"
                      >
                        Works on Saturday
                      </label>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setShowNewEmployeeDialog(false)}
                      >
                        Cancel
                      </Button>
                      <Button onClick={handleAddEmployee}>Add Employee</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {loadingEmployees && (
              <p className="text-sm text-muted-foreground">
                Loading employees...
              </p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {employees.map((employee) => (
                <Card
                  key={employee.id}
                  className="hover:shadow-md transition-shadow"
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback>{employee.avatar}</AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-medium">{employee.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {employee.role}
                          </p>
                        </div>
                      </div>
                      <Badge
                        className={getEmployeeStatusColor(employee.status)}
                      >
                        {employee.status}
                      </Badge>
                    </div>

                    <div className="space-y-2 mb-4 text-sm">
                      <div className="flex justify-between">
                        <span>Hourly Rate:</span>
                        <span className="font-medium">
                          {formatCurrency(employee.hourlyRate)}/hr
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Hours/Week:</span>
                        <span className="font-medium">
                          {employee.hoursPerWeek} hrs
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Approx Monthly:</span>
                        <span className="font-medium">
                          {formatCurrency(employee.monthlyRate)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Hire Date:</span>
                        <span>{formatDate(employee.hireDate)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Email:</span>
                        <span className="truncate ml-2">{employee.email}</span>
                      </div>
                    </div>

                    {/* <div className="flex flex-col gap-2">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 w-full"
                          onClick={() => openHourlyModal(employee)}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Set Hourly
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1 w-full"
                          onClick={() => openBonusModal(employee)}
                        >
                          <Gift className="h-4 w-4 mr-1" />
                          Add Bonus
                        </Button>
                      </div>
                    </div> */}

                    {/* Replace the existing button section with this: */}
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 w-full"
                          onClick={() => openEditEmployeeModal(employee)}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Edit Employee
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1 w-full"
                          onClick={() => openBonusModal(employee)}
                        >
                          <Gift className="h-4 w-4 mr-1" />
                          Add Bonus
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            {/* Edit Employee Modal */}
            <Dialog
              open={editEmployeeModalOpen}
              onOpenChange={setEditEmployeeModalOpen}
            >
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Employee</DialogTitle>
                  <DialogDescription>
                    Update employee information. Changes will be saved
                    immediately.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  {/* <div>
                    <label className="text-sm font-medium">First Name</label>
                    <Input
                      value={editEmployeeForm.firstName}
                      onChange={(e) =>
                        setEditEmployeeForm((prev) => ({
                          ...prev,
                          firstName: e.target.value,
                        }))
                      }
                      placeholder="Enter first name"
                    />
                  </div> */}

                  <div>
                    <label className="text-sm font-medium">First Name</label>
                    <Input
                      value={editEmployeeForm.firstName}
                      onChange={(e) =>
                        setEditEmployeeForm((prev) => ({
                          ...prev,
                          firstName: e.target.value,
                        }))
                      }
                      placeholder="Enter first name"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Last Name</label>
                    <Input
                      value={editEmployeeForm.lastName}
                      onChange={(e) =>
                        setEditEmployeeForm((prev) => ({
                          ...prev,
                          lastName: e.target.value,
                        }))
                      }
                      placeholder="Enter last name"
                    />
                  </div>
                  {/* <div>
                    <label className="text-sm font-medium">Last Name</label>
                    <Input
                      value={editEmployeeForm.lastName}
                      onChange={(e) =>
                        setEditEmployeeForm((prev) => ({
                          ...prev,
                          lastName: e.target.value,
                        }))
                      }
                      placeholder="Enter last name"
                    />
                  </div> */}
                  <div>
                    <label className="text-sm font-medium">Email</label>
                    <Input
                      type="email"
                      value={editEmployeeForm.email}
                      onChange={(e) =>
                        setEditEmployeeForm((prev) => ({
                          ...prev,
                          email: e.target.value,
                        }))
                      }
                      placeholder="employee@company.com"
                    />
                  </div>

                  {/* UPDATED: Role Dropdown */}
                  <div>
                    <label className="text-sm font-medium">Role</label>
                    <Select
                      value={editEmployeeForm.role}
                      onValueChange={(value) =>
                        setEditEmployeeForm((prev) => ({
                          ...prev,
                          role: value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="editor">Editor</SelectItem>
                        <SelectItem value="videographer">
                          Videographer
                        </SelectItem>
                        {/* <SelectItem value="qc_specialist">
                          QC Specialist
                        </SelectItem> */}
                        <SelectItem value="scheduler">Scheduler</SelectItem>
                        <SelectItem value="qc">QC</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium">
                      Hourly Rate ($)
                    </label>
                    <Input
                      type="number"
                      value={editEmployeeForm.hourlyRate}
                      onChange={(e) =>
                        setEditEmployeeForm((prev) => ({
                          ...prev,
                          hourlyRate: e.target.value,
                        }))
                      }
                      placeholder="0.00"
                    />
                  </div>

                  {/* Add this new field */}
                  <div>
                    <label className="text-sm font-medium">
                      Hours Per Week
                    </label>
                    <Input
                      type="number"
                      value={editEmployeeForm.hoursPerWeek}
                      onChange={(e) =>
                        setEditEmployeeForm((prev) => ({
                          ...prev,
                          hoursPerWeek: e.target.value,
                        }))
                      }
                      placeholder="40"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Typical full-time: 40 hours/week
                    </p>
                  </div>

                  {/* Add preview calculation */}
                  {editEmployeeForm.hourlyRate &&
                    editEmployeeForm.hoursPerWeek && (
                      <div className="text-sm bg-muted p-3 rounded-md">
                        <p className="font-medium">Monthly Salary Preview:</p>
                        <p className="text-lg font-bold text-primary">
                          {formatCurrency(
                            parseFloat(editEmployeeForm.hourlyRate || "0") *
                              parseFloat(editEmployeeForm.hoursPerWeek || "0") *
                              4
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          = ${editEmployeeForm.hourlyRate}/hr ×{" "}
                          {editEmployeeForm.hoursPerWeek} hrs/week × 4 weeks
                        </p>
                      </div>
                    )}
                  <div>
                    <label className="text-sm font-medium">Hire Date</label>
                    <SimpleCalendar
                      selected={editEmployeeForm.hireDate}
                      onSelect={(date) =>
                        setEditEmployeeForm((prev) => ({
                          ...prev,
                          hireDate: date,
                        }))
                      }
                      placeholder="Select hire date"
                    />
                  </div>

                  {/* UPDATED: Status with 3 options and descriptions */}
                  <div>
                    <label className="text-sm font-medium">
                      Employment Status
                    </label>
                    <Select
                      value={editEmployeeForm.status}
                      onValueChange={(
                        value: "active" | "inactive" | "terminated"
                      ) =>
                        setEditEmployeeForm((prev) => ({
                          ...prev,
                          status: value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-green-500"></span>
                            <span>Active - Currently working, on payroll</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="inactive">
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-yellow-500"></span>
                            <span>Inactive - Not currently working</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="terminated">
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-red-500"></span>
                            <span>Terminated - Permanently removed</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setEditEmployeeModalOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleEditEmployee}>Save Changes</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* Payroll Tab */}
          <TabsContent value="payroll" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3>Payroll Management</h3>
                <p className="text-sm text-muted-foreground">
                  Generate and track payroll based on hourly rates, bonuses, and
                  leave deductions
                </p>
              </div>
              <Dialog
                open={showPayrollDialog}
                onOpenChange={setShowPayrollDialog}
              >
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Generate Payroll
                  </Button>
                </DialogTrigger>
                <DialogContent aria-describedby="payroll-dialog-description">
                  <DialogHeader>
                    <DialogTitle id="payroll-dialog-title">
                      Generate Monthly Payroll
                    </DialogTitle>
                    <DialogDescription id="payroll-dialog-description">
                      This will generate payroll for all active employees for
                      the selected month and year.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">Month</label>
                        <Select
                          value={newPayroll.month}
                          onValueChange={(value) =>
                            setNewPayroll((prev) => ({
                              ...prev,
                              month: value,
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select month" />
                          </SelectTrigger>
                          <SelectContent>
                            {monthNames.map((month) => (
                              <SelectItem key={month} value={month}>
                                {month}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Year</label>
                        <Input
                          type="number"
                          value={newPayroll.year}
                          onChange={(e) =>
                            setNewPayroll((prev) => ({
                              ...prev,
                              year: parseInt(e.target.value) || prev.year,
                            }))
                          }
                        />
                      </div>
                    </div>

                    <div className="text-xs text-muted-foreground bg-muted p-3 rounded-md">
                      <p>Backend will calculate:</p>
                      <ul className="list-disc ml-4">
                        <li>Base salary = hourly × working days × 8</li>
                        <li>Sum of bonuses for that month</li>
                        <li>Leave-based deductions</li>
                      </ul>
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setShowPayrollDialog(false)}
                      >
                        Cancel
                      </Button>
                      <Button onClick={handleProcessPayroll}>
                        Generate Payroll
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {loadingPayroll && (
              <p className="text-sm text-muted-foreground">
                Loading payroll records...
              </p>
            )}

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
                              {
                                employees.find(
                                  (emp) => emp.id === record.employeeId
                                )?.avatar
                              }
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">
                            {record.employeeName}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {formatMonthRange(
                          Number(record.month),
                          Number(record.year)
                        )}

                        {/* {record.month} {record.year} */}
                      </TableCell>
                      <TableCell>{formatCurrency(record.baseSalary)}</TableCell>
                      <TableCell className="text-green-600">
                        {formatCurrency(record.bonuses)}
                      </TableCell>
                      <TableCell className="text-red-600">
                        {formatCurrency(record.deductions)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(record.netPay)}
                      </TableCell>
                      <TableCell>
                        <Badge className={getPayrollStatusColor(record.status)}>
                          {record.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={record.status}
                          onValueChange={(value) =>
                            handleUpdatePayrollStatus(
                              record,
                              value as PayrollRecord["status"]
                            )
                          }
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
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

      {/* Bonus Modal */}
      <Dialog open={bonusModalOpen} onOpenChange={setBonusModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Bonus</DialogTitle>
            <DialogDescription>
              Add a one-time bonus for{" "}
              <span className="font-semibold">
                {selectedEmployee?.name || "this employee"}
              </span>
              .
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Amount</label>
              <Input
                type="number"
                value={bonusAmount}
                onChange={(e) => setBonusAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setBonusModalOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveBonus}>Save Bonus</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hourly Rate Modal */}
      <Dialog open={hourlyModalOpen} onOpenChange={setHourlyModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Hourly Rate</DialogTitle>
            <DialogDescription>
              Update hourly rate for{" "}
              <span className="font-semibold">
                {selectedEmployee?.name || "this employee"}
              </span>
              . Monthly salary will be calculated from this.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Hourly Rate ($)</label>
              <Input
                type="number"
                value={hourlyRateInput}
                onChange={(e) => setHourlyRateInput(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="text-xs text-muted-foreground bg-muted p-3 rounded-md">
              <p>
                Approx monthly = hourly × {DEFAULT_WORKING_DAYS} working days ×
                8 hours.
              </p>
              {hourlyRateInput && (
                <p className="mt-1">
                  Preview:{" "}
                  <span className="font-semibold">
                    {formatCurrency(
                      parseFloat(hourlyRateInput || "0") *
                        DEFAULT_WORKING_DAYS *
                        8
                    )}
                  </span>{" "}
                  / month
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setHourlyModalOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveHourlyRate}>Save Rate</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Toaster />
    </>
  );
}
