"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { toast } from "sonner";
import {
  Users,
  UserPlus,
  Search,
  MoreHorizontal,
  Mail,
  Phone,
  Edit,
  Trash2,
  UserCheck,
  UserX,
} from "lucide-react";
import { SimpleCalendar } from "../ui/simple-calendar";

type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED";

interface LeaveRow {
  id: number;
  employeeId: number;
  employeeName: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: LeaveStatus;
  worksOnSaturday: boolean;
  createdAt?: string;
}

const roles = [
  {
    id: "admin",
    name: "Admin",
    color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  },
  {
    id: "manager",
    name: "Manager",
    color:
      "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  },
  {
    id: "editor",
    name: "Editor",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  },
  {
    id: "qc",
    name: "QC Specialist",
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  },
  {
    id: "scheduler",
    name: "Scheduler",
    color:
      "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  },
  {
    id: "videographer",
    name: "Videographer",
    color: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
  },
];

const statusOptions = [
  {
    id: "active",
    name: "Active",
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  },
  {
    id: "inactive",
    name: "Inactive",
    color: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  },
  {
    id: "terminated",
    name: "Terminated",
    color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  },
];

const apiFetch = async (path: string, options: RequestInit = {}) => {
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

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw new Error(data?.message || "Request failed");
  }

  return data;
};

const statusBadgeClass = (status: LeaveStatus) => {
  switch (status) {
    case "PENDING":
      return "bg-yellow-100 text-yellow-800";
    case "APPROVED":
      return "bg-green-100 text-green-800";
    case "REJECTED":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

const formatDate = (d: string | Date | undefined) => {
  if (!d) return "-";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
};

const calculateDays = (
  startDate: string,
  endDate: string,
  worksOnSaturday: boolean
) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;

  let count = 0;
  const d = new Date(start);

  while (d <= end) {
    const day = d.getDay();
    if (day !== 0) {
      if (day === 6 && !worksOnSaturday) {
        // skip Saturday if not working
      } else {
        count++;
      }
    }
    d.setDate(d.getDate() + 1);
  }

  return count;
};

const ITEMS_PER_PAGE = 10;

export default function LeavesComponent() {
  // ========== STATE - FIXED: SEPARATE FILTERS ==========
  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [leaveSearch, setLeaveSearch] = useState(""); // Renamed from 'search'
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [selectedLeave, setSelectedLeave] = useState<LeaveRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [leaveStatusFilter, setLeaveStatusFilter] = useState("ALL"); // Renamed from 'statusFilter'

  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [employeeStatusFilter, setEmployeeStatusFilter] = useState("all"); // Renamed from 'statusFilter'
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);

  // SEPARATE LOADING STATES
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [loadingLeaves, setLoadingLeaves] = useState(true);

  const [newUser, setNewUser] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    role: "",
    hourlyRate: "",
    hoursPerWeek: "40",
    hireDate: undefined as Date | undefined,
    worksOnSaturday: false,
    status: "active",
  });

  const [editEmployeeModalOpen, setEditEmployeeModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<any | null>(null);
  const [isEditingEmployee, setIsEditingEmployee] = useState(false);
  const [isAddingEmployee, setIsAddingEmployee] = useState(false);

  const [editEmployeeForm, setEditEmployeeForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    role: "",
    hourlyRate: "",
    hoursPerWeek: "",
    hireDate: undefined as Date | undefined,
    status: "active" as "active" | "inactive" | "terminated",
  });

  // ========== FUNCTIONS ==========

  const loadLeaves = async () => {
    try {
      setLoadingLeaves(true);
      console.log("🔄 Loading leaves...");
      const data = await apiFetch("/api/leave/list", { method: "GET" });
      console.log("📦 Leaves data:", data);

      const rows: LeaveRow[] =
        data?.leaves?.map((l: any) => ({
          id: l.id,
          employeeId: l.employeeId,
          employeeName: l.employeeName,
          startDate: l.startDate,
          endDate: l.endDate,
          reason: l.reason,
          status: (l.status as string).toUpperCase() as LeaveStatus,
          worksOnSaturday: !!l.worksOnSaturday,
          createdAt: l.createdAt,
        })) ?? [];

      console.log("✅ Mapped leaves:", rows);
      setLeaves(rows);
    } catch (err: any) {
      console.error("❌ Error loading leaves:", err);
      toast.error("Error loading leaves", { description: err.message });
    } finally {
      setLoadingLeaves(false);
    }
  };

  const loadEmployees = async () => {
    try {
      setLoadingEmployees(true);
      console.log("🔄 Loading employees...");

      const res = await fetch("api/employee/management");
      const data = await res.json();
      console.log("📦 Employees data:", data);

      if (data.ok) {
        const formatted = data.employees.map((u: any) => {
          const initials =
            u.name && u.name.trim() !== ""
              ? u.name
                  .split(" ")
                  .map((n: string) => n[0])
                  .join("")
              : "U";

          const tasksCount = u.assignedTasks?.length || 0;

          return {
            id: u.id,
            name: u.name || "No Name",
            email: u.email,
            phone: u.phone || "N/A",
            role: u.role,
            status:
              u.employeeStatus === "ACTIVE"
                ? "active"
                : u.employeeStatus === "INACTIVE"
                ? "inactive"
                : u.employeeStatus === "TERMINATED"
                ? "terminated"
                : "active",
            joinDate: u.joinedAt || null,
            lastActive: "N/A",
            tasksCompleted: tasksCount,
            avatar: initials,
          };
        });

        console.log("✅ Formatted employees:", formatted);
        setEmployees(formatted);
      }
    } catch (error) {
      console.error("❌ Failed to fetch employees:", error);
      toast.error("Failed to load employees");
    } finally {
      setLoadingEmployees(false);
    }
  };

  const handleAddUser = async () => {
    if (
      !newUser.firstName ||
      !newUser.lastName ||
      !newUser.email ||
      !newUser.hourlyRate ||
      !newUser.hireDate
    ) {
      toast.error("Please fill in all required fields.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newUser.email)) {
      toast.error("Please enter a valid email address.");
      return;
    }

    const hourlyRate = parseFloat(newUser.hourlyRate);
    if (isNaN(hourlyRate) || hourlyRate <= 0) {
      toast.error("Please enter a valid hourly rate.");
      return;
    }

    if (isAddingEmployee) return;
    setIsAddingEmployee(true);

    try {
      const hoursPerWeek = Number(newUser.hoursPerWeek);
      const fullName = `${newUser.firstName} ${newUser.lastName}`.trim();

      await apiFetch("/api/employee", {
        method: "POST",
        body: JSON.stringify({
          name: fullName,
          email: newUser.email,
          role: newUser.role || "editor",
          hourlyRate,
          hoursPerWeek,
          joinedAt: newUser.hireDate.toISOString(),
          worksOnSaturday: newUser.worksOnSaturday,
        }),
      });

      toast.success("✅ Employee Added", {
        description: `${fullName} has been added. Welcome email sent to ${newUser.email}`,
      });

      setNewUser({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        role: "",
        hourlyRate: "",
        hoursPerWeek: "40",
        hireDate: undefined,
        worksOnSaturday: false,
        status: "active",
      });

      setIsAddUserDialogOpen(false);

      // Reload in background without blocking
      setTimeout(() => loadEmployees(), 100);
    } catch (err: any) {
      console.error("Add employee error:", err);
      toast.error("Failed to add employee", {
        description: err.message || "An error occurred.",
      });
    } finally {
      setIsAddingEmployee(false);
    }
  };

  const openEditEmployeeModal = (employee: any) => {
    const [firstName, ...lastNameParts] = employee.name.split(" ");
    const lastName = lastNameParts.join(" ");

    setEditingEmployee(employee);
    setEditEmployeeForm({
      firstName: firstName || "",
      lastName: lastName || "",
      email: employee.email,
      phone: employee.phone || "",
      role: employee.role,
      hourlyRate: String(employee.hourlyRate || 0),
      hoursPerWeek: String(employee.hoursPerWeek || 40),
      hireDate: employee.joinDate ? new Date(employee.joinDate) : undefined,
      status: employee.status,
    });
    setEditEmployeeModalOpen(true);
  };

  const handleEditEmployee = async () => {
    if (!editingEmployee || isEditingEmployee) return;

    if (
      !editEmployeeForm.firstName ||
      !editEmployeeForm.lastName ||
      !editEmployeeForm.email
    ) {
      toast.error("Please fill in all required fields.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(editEmployeeForm.email)) {
      toast.error("Please enter a valid email address.");
      return;
    }

    const hourlyRate = parseFloat(editEmployeeForm.hourlyRate);
    if (isNaN(hourlyRate) || hourlyRate < 0) {
      toast.error("Please enter a valid hourly rate.");
      return;
    }

    setIsEditingEmployee(true);

    try {
      const hoursPerWeek = Number(editEmployeeForm.hoursPerWeek);
      const fullName =
        `${editEmployeeForm.firstName} ${editEmployeeForm.lastName}`.trim();

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
          phone: editEmployeeForm.phone,
          employeeStatus: statusMap[editEmployeeForm.status],
          joinedAt: editEmployeeForm.hireDate?.toISOString(),
        }),
      });

      toast.success("✅ Employee Updated", {
        description: `${fullName}'s information has been updated successfully.`,
      });

      // Close modal IMMEDIATELY
      setEditEmployeeModalOpen(false);
      setEditingEmployee(null);
      // setIsEditingEmployee(false);
      setEditEmployeeModalOpen(false);

      // Reload in background after a tiny delay
      setTimeout(() => loadEmployees(), 100);
    } catch (err: any) {
      console.error("Edit employee error:", err);
      toast.error("Failed to update employee", {
        description: err.message || "An error occurred.",
      });
      setIsEditingEmployee(false);
    }
  };

  const handleDeleteUser = (userId: number) => {
    console.log("Deleting user:", userId);
  };

  const handleUpdateUserStatus = (userId: number, newStatus: string) => {
    console.log("Updating user status:", userId, newStatus);
  };

  const handleOpenDetails = (leave: LeaveRow) => {
    setSelectedLeave(leave);
    setDetailOpen(true);
  };

  const handleApprove = async (leave: LeaveRow) => {
    try {
      await apiFetch(`/api/leave/${leave.id}/approve`, {
        method: "PATCH",
      });
      toast.success("Leave approved", {
        description:
          "Deduction has been created for this leave and will be applied in payroll.",
      });
      setDetailOpen(false);
      await loadLeaves();
    } catch (err: any) {
      console.error(err);
      toast.error("Error approving leave", { description: err.message });
    }
  };

  const handleReject = async (leave: LeaveRow) => {
    try {
      await apiFetch(`/api/leave/${leave.id}/reject`, {
        method: "PATCH",
      });
      toast.success("Leave rejected");
      setDetailOpen(false);
      await loadLeaves();
    } catch (err: any) {
      console.error(err);
      toast.error("Error rejecting leave", { description: err.message });
    }
  };

  // ========== EFFECTS ==========
  useEffect(() => {
    loadLeaves();
  }, []);

  useEffect(() => {
    loadEmployees();
  }, []);

  // ========== COMPUTED VALUES - FIXED FILTER NAMES ==========
  const filteredEmployees = employees.filter((employee) => {
    const matchesSearch =
      employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === "all" || employee.role === roleFilter;
    const matchesStatus =
      employeeStatusFilter === "all" ||
      employee.status === employeeStatusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

  const getRoleBadge = (roleId: string) => {
    const role = roles.find((r) => r.id === roleId);
    return role ? <Badge className={role.color}>{role.name}</Badge> : null;
  };

  const getStatusBadge = (statusId: string) => {
    const status = statusOptions.find((s) => s.id === statusId);
    return status ? (
      <Badge className={status.color}>{status.name}</Badge>
    ) : null;
  };

  const filteredLeaves = useMemo(() => {
    console.log("🔍 Filtering leaves:", {
      totalLeaves: leaves.length,
      leaveStatusFilter,
      leaveSearch,
    });

    return leaves
      .filter((l) => {
        if (leaveStatusFilter === "ALL") return true;
        return l.status === leaveStatusFilter;
      })
      .filter((l) => {
        if (!leaveSearch.trim()) return true;
        const s = leaveSearch.toLowerCase();
        return (
          l.employeeName.toLowerCase().includes(s) ||
          l.reason.toLowerCase().includes(s)
        );
      })
      .filter((l) => {
        if (!fromDate && !toDate) return true;

        const start = new Date(l.startDate);
        const end = new Date(l.endDate);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()))
          return false;

        if (fromDate) {
          const f = new Date(fromDate);
          if (start < f && end < f) return false;
        }
        if (toDate) {
          const t = new Date(toDate);
          if (start > t && end > t) return false;
        }
        return true;
      });
  }, [leaves, leaveStatusFilter, leaveSearch, fromDate, toDate]);

  console.log("📊 Filtered leaves count:", filteredLeaves.length);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredLeaves.length / ITEMS_PER_PAGE)
  );
  const currentPage = Math.min(page, totalPages);
  const paginatedLeaves = filteredLeaves.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // ========== RENDER ==========
  return (
    <div className="space-y-6">
      {/* Employee Management Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Employee Management
            </CardTitle>

            <Dialog
              open={isAddUserDialogOpen}
              onOpenChange={setIsAddUserDialogOpen}
            >
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add Employee
                </Button>
              </DialogTrigger>
              <DialogContent
                aria-describedby="add-employee-description"
                className="max-h-[90vh] overflow-y-auto"
              >
                <DialogHeader>
                  <DialogTitle id="add-employee-title">
                    Add New Employee
                  </DialogTitle>
                  <DialogDescription id="add-employee-description">
                    Fill in the details below to add a new employee to the
                    system.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">
                        First Name *
                      </label>
                      <Input
                        value={newUser.firstName}
                        onChange={(e) =>
                          setNewUser({ ...newUser, firstName: e.target.value })
                        }
                        placeholder="Enter first name"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Last Name *</label>
                      <Input
                        value={newUser.lastName}
                        onChange={(e) =>
                          setNewUser({ ...newUser, lastName: e.target.value })
                        }
                        placeholder="Enter last name"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Email *</label>
                    <Input
                      type="email"
                      value={newUser.email}
                      onChange={(e) =>
                        setNewUser({ ...newUser, email: e.target.value })
                      }
                      placeholder="employee@company.com"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Phone</label>
                    <Input
                      value={newUser.phone}
                      onChange={(e) =>
                        setNewUser({ ...newUser, phone: e.target.value })
                      }
                      placeholder="Enter phone number"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Role *</label>
                    <Select
                      value={newUser.role}
                      onValueChange={(value) =>
                        setNewUser({ ...newUser, role: value })
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
                        <SelectItem value="qc">QC Specialist</SelectItem>
                        <SelectItem value="client">Client</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium">
                      Hourly Rate ($) *
                    </label>
                    <Input
                      type="number"
                      value={newUser.hourlyRate}
                      onChange={(e) =>
                        setNewUser({ ...newUser, hourlyRate: e.target.value })
                      }
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">
                      Hours Per Week
                    </label>
                    <Input
                      type="number"
                      value={newUser.hoursPerWeek}
                      onChange={(e) =>
                        setNewUser({ ...newUser, hoursPerWeek: e.target.value })
                      }
                      placeholder="40"
                      min="0"
                      max="168"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Typical full-time: 40 hours/week
                    </p>
                  </div>

                  {newUser.hourlyRate && newUser.hoursPerWeek && (
                    <div className="text-sm bg-muted p-3 rounded-md">
                      <p className="font-medium">Monthly Salary Preview:</p>
                      <p className="text-lg font-bold text-primary">
                        $
                        {(
                          parseFloat(newUser.hourlyRate || "0") *
                          parseFloat(newUser.hoursPerWeek || "0") *
                          4
                        ).toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        = ${newUser.hourlyRate}/hr × {newUser.hoursPerWeek}{" "}
                        hrs/week × 4 weeks
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="text-sm font-medium">Hire Date *</label>
                    <SimpleCalendar
                      selected={newUser.hireDate}
                      onSelect={(date) =>
                        setNewUser({ ...newUser, hireDate: date })
                      }
                      placeholder="Select hire date"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="worksOnSaturday"
                      checked={newUser.worksOnSaturday}
                      onChange={(e) =>
                        setNewUser({
                          ...newUser,
                          worksOnSaturday: e.target.checked,
                        })
                      }
                      className="h-4 w-4"
                    />
                    <label
                      htmlFor="worksOnSaturday"
                      className="text-sm font-medium cursor-pointer"
                    >
                      Works on Saturday
                    </label>
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <Button
                      variant="outline"
                      onClick={() => setIsAddUserDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleAddUser} disabled={isAddingEmployee}>
                      {isAddingEmployee ? (
                        <>
                          <span className="animate-spin mr-2">⏳</span>
                          Adding...
                        </>
                      ) : (
                        "Add Employee"
                      )}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search employees..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64"
              />
            </div>

            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={employeeStatusFilter}
              onValueChange={setEmployeeStatusFilter}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {statusOptions.map((status) => (
                  <SelectItem key={status.id} value={status.id}>
                    {status.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto">
            {loadingEmployees ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <span className="ml-3 text-muted-foreground">
                  Loading employees...
                </span>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Employee</th>
                    <th className="text-left py-3 px-4">Role</th>
                    <th className="text-left py-3 px-4">Status</th>
                    <th className="text-left py-3 px-4">Contact</th>
                    <th className="text-left py-3 px-4">Join Date</th>
                    <th className="text-left py-3 px-4">Last Active</th>
                    <th className="text-left py-3 px-4">Tasks</th>
                    <th className="text-right py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((employee) => (
                    <tr
                      key={employee.id}
                      className="border-b hover:bg-muted/50"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                            {employee.avatar}
                          </div>
                          <div>
                            <div className="font-medium">{employee.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {employee.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {getRoleBadge(employee.role)}
                      </td>
                      <td className="py-3 px-4">
                        {getStatusBadge(employee.status)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="h-3 w-3" />
                            {employee.email}
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="h-3 w-3" />
                            {employee.phone}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm">
                        {employee.joinDate
                          ? new Date(employee.joinDate).toLocaleDateString()
                          : "-"}
                      </td>
                      <td className="py-3 px-4 text-sm">
                        {employee.lastActive}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="outline">
                          {employee.tasksCompleted}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => openEditEmployeeModal(employee)}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Edit Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                handleUpdateUserStatus(
                                  employee.id,
                                  employee.status === "active"
                                    ? "inactive"
                                    : "active"
                                )
                              }
                            >
                              {employee.status === "active" ? (
                                <>
                                  <UserX className="h-4 w-4 mr-2" />
                                  Deactivate
                                </>
                              ) : (
                                <>
                                  <UserCheck className="h-4 w-4 mr-2" />
                                  Activate
                                </>
                              )}
                            </DropdownMenuItem>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem
                                  onSelect={(e) => e.preventDefault()}
                                  className="text-red-600"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    Delete Employee
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete{" "}
                                    {employee.name}? This action cannot be
                                    undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() =>
                                      handleDeleteUser(employee.id)
                                    }
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Employee Modal */}
      <Dialog
        key={editingEmployee?.id ?? "edit-employee"}
        open={editEmployeeModalOpen}
        onOpenChange={setEditEmployeeModalOpen}
      >
        <DialogContent
          className="max-h-[90vh] overflow-y-auto"
          aria-describedby="edit-employee-description"
        >
          <DialogHeader>
            <DialogTitle id="edit-employee-title">Edit Employee</DialogTitle>
            <DialogDescription id="edit-employee-description">
              Update employee information.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">First Name *</label>
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
                <label className="text-sm font-medium">Last Name *</label>
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
            </div>

            <div>
              <label className="text-sm font-medium">Email *</label>
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

            <div>
              <label className="text-sm font-medium">Phone</label>
              <Input
                value={editEmployeeForm.phone}
                onChange={(e) =>
                  setEditEmployeeForm((prev) => ({
                    ...prev,
                    phone: e.target.value,
                  }))
                }
                placeholder="Enter phone number"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Role *</label>
              <Select
                value={editEmployeeForm.role}
                onValueChange={(value) =>
                  setEditEmployeeForm((prev) => ({ ...prev, role: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="videographer">Videographer</SelectItem>
                  <SelectItem value="scheduler">Scheduler</SelectItem>
                  <SelectItem value="qc">QC Specialist</SelectItem>
                  <SelectItem value="client">Client</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Hourly Rate ($) *</label>
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
                step="0.01"
                min="0"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Hours Per Week</label>
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
                min="0"
                max="168"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Typical full-time: 40 hours/week
              </p>
            </div>

            {editEmployeeForm.hourlyRate && editEmployeeForm.hoursPerWeek && (
              <div className="text-sm bg-muted p-3 rounded-md">
                <p className="font-medium">Monthly Salary Preview:</p>
                <p className="text-lg font-bold text-primary">
                  $
                  {(
                    parseFloat(editEmployeeForm.hourlyRate || "0") *
                    parseFloat(editEmployeeForm.hoursPerWeek || "0") *
                    4
                  ).toFixed(2)}
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
                  setEditEmployeeForm((prev) => ({ ...prev, hireDate: date }))
                }
                placeholder="Select hire date"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Employment Status</label>
              <Select
                value={editEmployeeForm.status}
                onValueChange={(value: "active" | "inactive" | "terminated") =>
                  setEditEmployeeForm((prev) => ({ ...prev, status: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-green-500"></span>
                      <span>Active</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="inactive">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-yellow-500"></span>
                      <span>Inactive</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="terminated">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-red-500"></span>
                      <span>Terminated</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setEditEmployeeModalOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleEditEmployee} disabled={isEditingEmployee}>
                {isEditingEmployee ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span>
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Leave Management Section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Leave Management</h2>
          <p className="text-sm text-muted-foreground">
            Review and approve employee leave requests.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <Input
            className="w-48"
            placeholder="Search by employee/reason"
            value={leaveSearch}
            onChange={(e) => {
              setLeaveSearch(e.target.value);
              setPage(1);
            }}
          />
          <Input
            type="date"
            className="w-36"
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value);
              setPage(1);
            }}
          />
          <Input
            type="date"
            className="w-36"
            value={toDate}
            onChange={(e) => {
              setToDate(e.target.value);
              setPage(1);
            }}
          />
          <Select
            value={leaveStatusFilter}
            onValueChange={(v: string) => {
              setLeaveStatusFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loadingLeaves ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-3 text-muted-foreground">
                Loading leaves...
              </span>
            </div>
          ) : filteredLeaves.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              No leave records found.
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Date Range</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedLeaves.map((l) => {
                    const days = calculateDays(
                      l.startDate,
                      l.endDate,
                      l.worksOnSaturday
                    );
                    return (
                      <TableRow
                        key={l.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleOpenDetails(l)}
                      >
                        <TableCell>{l.employeeName}</TableCell>
                        <TableCell>
                          {formatDate(l.startDate)} → {formatDate(l.endDate)}
                        </TableCell>
                        <TableCell>{days}</TableCell>
                        <TableCell className="max-w-xs truncate">
                          {l.reason}
                        </TableCell>
                        <TableCell>
                          <Badge className={statusBadgeClass(l.status)}>
                            {l.status}
                          </Badge>
                        </TableCell>
                        <TableCell
                          onClick={(e) => e.stopPropagation()}
                          className="space-x-2"
                        >
                          {l.status === "PENDING" && (
                            <>
                              <Button
                                size="sm"
                                className="cursor-pointer"
                                onClick={() => handleApprove(l)}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                className="cursor-pointer"
                                variant="destructive"
                                onClick={() => handleReject(l)}
                              >
                                Reject
                              </Button>
                            </>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              <div className="flex items-center justify-between px-4 py-2 border-t">
                <span className="text-xs text-muted-foreground">
                  Page {currentPage} of {totalPages} • {filteredLeaves.length}{" "}
                  total leaves
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={currentPage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Prev
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={currentPage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Leave Detail Modal */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave Details</DialogTitle>
            <DialogDescription>
              Review the request before approving or rejecting.
            </DialogDescription>
          </DialogHeader>
          {selectedLeave && (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Employee</span>
                <span className="font-medium">
                  {selectedLeave.employeeName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date Range</span>
                <span>
                  {formatDate(selectedLeave.startDate)} →{" "}
                  {formatDate(selectedLeave.endDate)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Days</span>
                <span className="font-medium">
                  {calculateDays(
                    selectedLeave.startDate,
                    selectedLeave.endDate,
                    selectedLeave.worksOnSaturday
                  )}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-1">Reason</span>
                <p className="border rounded-md p-2 bg-muted/40">
                  {selectedLeave.reason || "-"}
                </p>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Status</span>
                <Badge className={statusBadgeClass(selectedLeave.status)}>
                  {selectedLeave.status}
                </Badge>
              </div>

              {selectedLeave.status === "PENDING" && (
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleReject(selectedLeave)}
                  >
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleApprove(selectedLeave)}
                  >
                    Approve & Create Deduction
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
