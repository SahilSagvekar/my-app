import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
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
import { VisuallyHidden } from "../ui/visually-hidden";
import {
  Users,
  UserPlus,
  Search,
  MoreHorizontal,
  Mail,
  Phone,
  Calendar,
  Edit,
  Trash2,
  UserCheck,
  UserX,
  Filter,
} from "lucide-react";
import { SimpleCalendar } from "../ui/simple-calendar";
// import {
//   Table,
//   TableBody,
//   TableCell,
//   TableHead,
//   TableHeader,
//   TableRow,
// } from "../ui/table";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

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

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount || 0);
};

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

const employees = [
  {
    id: 1,
    name: "Sarah Johnson",
    email: "sarah.johnson@company.com",
    phone: "+1 (555) 123-4567",
    role: "admin",
    status: "active",
    joinDate: "2023-01-15",
    lastActive: "2024-08-10 14:30",
    tasksCompleted: 45,
    avatar: "SJ",
  },
  {
    id: 2,
    name: "Michael Chen",
    email: "michael.chen@company.com",
    phone: "+1 (555) 234-5678",
    role: "manager",
    status: "active",
    joinDate: "2023-03-20",
    lastActive: "2024-08-10 16:15",
    tasksCompleted: 32,
    avatar: "MC",
  },
  {
    id: 3,
    name: "Emma Wilson",
    email: "emma.wilson@company.com",
    phone: "+1 (555) 345-6789",
    role: "editor",
    status: "active",
    joinDate: "2023-05-10",
    lastActive: "2024-08-10 15:45",
    tasksCompleted: 87,
    avatar: "EW",
  },
  {
    id: 4,
    name: "David Rodriguez",
    email: "david.rodriguez@company.com",
    phone: "+1 (555) 456-7890",
    role: "qc",
    status: "active",
    joinDate: "2023-07-22",
    lastActive: "2024-08-10 13:20",
    tasksCompleted: 63,
    avatar: "DR",
  },
  {
    id: 5,
    name: "Lisa Park",
    email: "lisa.park@company.com",
    phone: "+1 (555) 567-8901",
    role: "scheduler",
    status: "on-leave",
    joinDate: "2023-09-05",
    lastActive: "2024-08-07 17:00",
    tasksCompleted: 28,
    avatar: "LP",
  },
  {
    id: 6,
    name: "James Thompson",
    email: "james.thompson@company.com",
    phone: "+1 (555) 678-9012",
    role: "account-manager",
    status: "active",
    joinDate: "2023-11-18",
    lastActive: "2024-08-10 12:10",
    tasksCompleted: 19,
    avatar: "JT",
  },
  {
    id: 7,
    name: "Maria Garcia",
    email: "maria.garcia@company.com",
    phone: "+1 (555) 789-0123",
    role: "editor",
    status: "inactive",
    joinDate: "2024-01-08",
    lastActive: "2024-08-02 09:30",
    tasksCompleted: 12,
    avatar: "MG",
  },
  {
    id: 8,
    name: "Alex Rodriguez",
    email: "alex.rodriguez@company.com",
    phone: "+1 (555) 890-1234",
    role: "videographer",
    status: "active",
    joinDate: "2024-02-15",
    lastActive: "2024-08-10 18:20",
    tasksCompleted: 34,
    avatar: "AR",
  },
];

export default function LeavesComponent() {
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
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
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [leaveSearch, setLeaveSearch] = useState(""); // Renamed from 'search'
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [detailOpen, setDetailOpen] = useState(false);
  const [leaveStatusFilter, setLeaveStatusFilter] = useState("ALL"); // Renamed from 'statusFilter'
  const [employeeStatusFilter, setEmployeeStatusFilter] = useState("all"); // Renamed from 'statusFilter'
  // SEPARATE LOADING STATES
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [loadingLeaves, setLoadingLeaves] = useState(true);
  const [editEmployeeModalOpen, setEditEmployeeModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<any | null>(null);
  const [isEditingEmployee, setIsEditingEmployee] = useState(false);
  const [isAddingEmployee, setIsAddingEmployee] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState<LeaveRow | null>(null);

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
  const [isSavingEmployee, setIsSavingEmployee] = useState(false);

  // FETCH EMPLOYEES FROM YOUR API
  // ------------------------------
  // useEffect(() => {

  //   async function loadEmployees() {
  //     try {
  //       const res = await fetch("api/employee/list");
  //       const data = await res.json();

  //       if (data.ok) {
  //         const formatted = data.employees.map((u: any) => {
  //           const initials =
  //             u.name && u.name.trim() !== ""
  //               ? u.name
  //                   .split(" ")
  //                   .map((n: string) => n[0])
  //                   .join("")
  //               : "U";

  //           return {
  //             id: u.id,
  //             name: u.name || "No Name",
  //             email: u.email,
  //             phone: "N/A", // because User model has no phone field
  //             role: u.role,
  //             status:
  //               u.employeeStatus === "ACTIVE"
  //                 ? "active"
  //                 : u.employeeStatus === "INACTIVE"
  //                 ? "inactive"
  //                 : "active",
  //             joinDate: u.joinedAt || null,
  //             lastActive: "N/A", // field not in DB
  //             tasksCompleted: 0, // field not in DB
  //             avatar: initials
  //           };
  //         });

  //         setEmployees(formatted);

  //       }
  //     } catch (error) {
  //       console.error("Failed to fetch employees →", error);
  //     } finally {
  //       setLoading(false);
  //     }
  //   }

  //   loadEmployees();
  // }, []);

  // const filteredEmployees = employees.filter(employee => {
  //   const matchesSearch = employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
  //                        employee.email.toLowerCase().includes(searchTerm.toLowerCase());
  //   const matchesRole = roleFilter === 'all' || employee.role === roleFilter;
  //   const matchesStatus = statusFilter === 'all' || employee.status === statusFilter;

  //   return matchesSearch && matchesRole && matchesStatus;
  // });

  // const getRoleBadge = (roleId: string) => {
  //   const role = roles.find(r => r.id === roleId);
  //   return role ? (
  //     <Badge className={role.color}>
  //       {role.name}
  //     </Badge>
  //   ) : null;
  // };

  // const getStatusBadge = (statusId: string) => {
  //   const status = statusOptions.find(s => s.id === statusId);
  //   return status ? (
  //     <Badge className={status.color}>
  //       {status.name}
  //     </Badge>
  //   ) : null;
  // };

  // const handleAddUser = () => {
  //   setIsAddUserDialogOpen(false);
  //   setNewUser({ name: '', email: '', phone: '', role: '', status: 'active' });
  // };

  // const handleDeleteUser = (userId: number) => {
  //   console.log('Deleting user:', userId);
  // };

  // const handleUpdateUserStatus = (userId: number, newStatus: string) => {
  //   console.log('Updating user status:', userId, newStatus);
  // };

  const roleStats = roles.map((role) => ({
    ...role,
    count: employees.filter((emp) => emp.role === role.id).length,
  }));

  const statusStats = statusOptions.map((status) => ({
    ...status,
    count: employees.filter((emp) => emp.status === status.id).length,
  }));

  //funtions

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
            hourlyRate: u.hourlyRate,
            monthlyRate: u.monthlyRate,
            hoursPerWeek: u.hoursPerWeek,
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
  // if (
  //   !newUser.firstName ||
  //   !newUser.lastName ||
  //   !newUser.email ||
  //   !newUser.hourlyRate ||
  //   !newUser.hireDate
  // ) {
  //   toast.error("Please fill in all required fields.");
  //   return;
  // }

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

    if (!newUser.hireDate) {
      toast.error("Please select a hire date.");
      setIsAddingEmployee(false);
      return;
    }

    await apiFetch("/api/employee", {
      method: "POST",
      body: JSON.stringify({
        name: fullName,
        email: newUser.email,
        role: newUser.role || "editor",
        phone: newUser.phone,
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

    // Reload employees
    await loadEmployees();
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
  console.log('Opening edit modal for:', employee);
  
  const [firstName, ...lastNameParts] = (employee.name || '').split(" ");
  const lastName = lastNameParts.join(" ");

  setEditingEmployee(employee);
  
  // Use setTimeout to batch state updates
  setTimeout(() => {
    setEditEmployeeForm({
      firstName: firstName || "",
      lastName: lastName || "",
      email: employee.email || "",
      phone: employee.phone || "",
      role: employee.role || "",
      hourlyRate: String(employee.hourlyRate || 0),
      hoursPerWeek: String(employee.hoursPerWeek || 40),
      hireDate: employee.joinDate ? new Date(employee.joinDate) : undefined,
      status: employee.status || "active",
    });
    setEditEmployeeModalOpen(true);
  }, 0);
};

  const router = useRouter();

  // Add this at the top with other state
  const isUpdatingRef = useRef(false);

  const handleEditEmployee = useCallback(async () => {
    if (!editingEmployee || isSavingEmployee || isUpdatingRef.current) {
      return;
    }

    isUpdatingRef.current = true;
    setIsSavingEmployee(true);

    try {
      // const hourlyRate = parseFloat(editEmployeeForm.hourlyRate);
      const hourlyRate = Number(editEmployeeForm.hourlyRate);
      const hoursPerWeek = Number(editEmployeeForm.hoursPerWeek);
      const fullName =
        `${editEmployeeForm.firstName} ${editEmployeeForm.lastName}`.trim();
      const monthlyRate = Number(hourlyRate) * Number(hoursPerWeek) * 4

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
          monthlyRate: monthlyRate,
          phone: editEmployeeForm.phone,
          employeeStatus: statusMap[editEmployeeForm.status],
          joinedAt: editEmployeeForm.hireDate?.toISOString(),
        }),
      });

      toast.success("Employee Updated");

      // Store current page in localStorage before reload
      localStorage.setItem("returnToPage", "leaves");

      window.location.reload();
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to update employee", {
        description: err.message || "An error occurred.",
      });
      isUpdatingRef.current = false;
      setIsSavingEmployee(false);
    }
  }, [editingEmployee, editEmployeeForm, isSavingEmployee]);

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
  const filteredEmployees = useMemo(() => {
    return employees.filter((employee) => {
      const matchesSearch =
        employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = roleFilter === "all" || employee.role === roleFilter;
      const matchesStatus =
        employeeStatusFilter === "all" ||
        employee.status === employeeStatusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [employees, searchTerm, roleFilter, employeeStatusFilter]);

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
    // DELETE THIS LINE if it exists:
    // console.log("🔍 Filtering leaves:", {...});

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

  const totalPages = Math.max(
    1,
    Math.ceil(filteredLeaves.length / ITEMS_PER_PAGE)
  );
  const currentPage = Math.min(page, totalPages);
  const paginatedLeaves = filteredLeaves.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="space-y-6">
      {/* Filters and Search */}
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
              <DialogContent aria-describedby="add-employee-description">
                <DialogHeader>
                  <DialogTitle id="add-employee-title">
                    Add New Employee
                  </DialogTitle>
                  <DialogDescription id="add-employee-description">
                    Add a new employee with their hourly rate. Monthly rate will
                    be calculated automatically.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">First Name</label>
                      <Input
                        value={newUser.firstName}
                        onChange={(e) =>
                          setNewUser((prev) => ({
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
                        value={newUser.lastName}
                        onChange={(e) =>
                          setNewUser((prev) => ({
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
                      value={newUser.email}
                      onChange={(e) =>
                        setNewUser((prev) => ({
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
                      value={newUser.phone}
                      onChange={(e) =>
                        setNewUser((prev) => ({
                          ...prev,
                          phone: e.target.value,
                        }))
                      }
                      placeholder="Enter phone number"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Role</label>
                    <Select
                      value={newUser.role}
                      onValueChange={(value) =>
                        setNewUser((prev) => ({
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
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium">
                      Hourly Rate ($)
                    </label>
                    <Input
                      type="number"
                      value={newUser.hourlyRate}
                      onChange={(e) =>
                        setNewUser((prev) => ({
                          ...prev,
                          hourlyRate: e.target.value,
                        }))
                      }
                      placeholder="0.00"
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
                        setNewUser((prev) => ({
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

                  {/* Preview calculation */}
                  {newUser.hourlyRate && newUser.hoursPerWeek && (
                    <div className="text-sm bg-muted p-3 rounded-md">
                      <p className="font-medium">Monthly Salary Preview:</p>
                      <p className="text-lg font-bold text-primary">
                        {formatCurrency(
                          parseFloat(newUser.hourlyRate || "0") *
                            parseFloat(newUser.hoursPerWeek || "0") *
                            4
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        = ${newUser.hourlyRate}/hr × {newUser.hoursPerWeek}{" "}
                        hrs/week × 4 weeks
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="text-sm font-medium">Hire Date</label>
                    <SimpleCalendar
                      selected={newUser.hireDate}
                      onSelect={(date) =>
                        setNewUser((prev) => ({
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
                      checked={newUser.worksOnSaturday}
                      onChange={(e) =>
                        setNewUser((prev) => ({
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

                  <div className="flex justify-end gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setIsAddUserDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleAddUser} disabled={isAddingEmployee}>
                      {isAddingEmployee ? "Adding..." : "Add Employee"}
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

            <Select value={statusFilter} onValueChange={setStatusFilter}>
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
                  <tr key={employee.id} className="border-b hover:bg-muted/50">
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
                    <td className="py-3 px-4">{getRoleBadge(employee.role)}</td>
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
                      {new Date(employee.joinDate).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-sm">{employee.lastActive}</td>
                    <td className="py-3 px-4">
                      <Badge variant="outline">{employee.tasksCompleted}</Badge>
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
                                  {employee.name}? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteUser(employee.id)}
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
          </div>
        </CardContent>
      </Card>

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
                          onClick={(e: React.MouseEvent) => e.stopPropagation()}
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

      {/* Edit Employee Modal */}

      {/* <Dialog
        open={editEmployeeModalOpen}
        onOpenChange={setEditEmployeeModalOpen}
      >
        <DialogContent
          className="max-w-2xl"
          onEscapeKeyDown={(e) => {
            e.preventDefault();
            setEditEmployeeModalOpen(false);
            setEditingEmployee(null);
          }}
          onPointerDownOutside={(e) => {
            e.preventDefault();
            setEditEmployeeModalOpen(false);
            setEditingEmployee(null);
          }}
        >
          <DialogHeader>
            <DialogTitle>Edit Employee</DialogTitle>
            <DialogDescription>
              Update employee information and settings.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">First Name</label>
                <Input
                  value={editEmployeeForm.firstName}
                  onChange={(e) =>
                    setEditEmployeeForm({
                      ...editEmployeeForm,
                      firstName: e.target.value,
                    })
                  }
                  placeholder="First name"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Last Name</label>
                <Input
                  value={editEmployeeForm.lastName}
                  onChange={(e) =>
                    setEditEmployeeForm({
                      ...editEmployeeForm,
                      lastName: e.target.value,
                    })
                  }
                  placeholder="Last name"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                value={editEmployeeForm.email}
                onChange={(e) =>
                  setEditEmployeeForm({
                    ...editEmployeeForm,
                    email: e.target.value,
                  })
                }
                placeholder="Email address"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Phone</label>
              <Input
                value={editEmployeeForm.phone}
                onChange={(e) =>
                  setEditEmployeeForm({
                    ...editEmployeeForm,
                    phone: e.target.value,
                  })
                }
                placeholder="Phone number"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Role</label>
                <Select
                  value={editEmployeeForm.role}
                  onValueChange={(value) =>
                    setEditEmployeeForm({ ...editEmployeeForm, role: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">Status</label>
                <Select
                  value={editEmployeeForm.status}
                  onValueChange={(
                    value: "active" | "inactive" | "terminated"
                  ) =>
                    setEditEmployeeForm({ ...editEmployeeForm, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((status) => (
                      <SelectItem key={status.id} value={status.id}>
                        {status.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Hourly Rate (₹)</label>
                <Input
                  type="number"
                  value={editEmployeeForm.hourlyRate}
                  onChange={(e) =>
                    setEditEmployeeForm({
                      ...editEmployeeForm,
                      hourlyRate: e.target.value,
                    })
                  }
                  placeholder="0"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Hours/Week</label>
                <Input
                  type="number"
                  value={editEmployeeForm.hoursPerWeek}
                  onChange={(e) =>
                    setEditEmployeeForm({
                      ...editEmployeeForm,
                      hoursPerWeek: e.target.value,
                    })
                  }
                  placeholder="40"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Hire Date</label>
              <Input
                type="date"
                value={
                  editEmployeeForm.hireDate
                    ? editEmployeeForm.hireDate.toISOString().split("T")[0]
                    : ""
                }
                onChange={(e) => {
                  const date = e.target.value
                    ? new Date(e.target.value)
                    : undefined;
                  setEditEmployeeForm({ ...editEmployeeForm, hireDate: date });
                }}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log("Cancel clicked");
                  setEditEmployeeModalOpen(false);
                  setEditingEmployee(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleEditEmployee();
                }}
              >
                Update Employee
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog> */}

      <Dialog
        open={editEmployeeModalOpen}
        onOpenChange={setEditEmployeeModalOpen}
      >
        <DialogContent
          className="max-w-3xl max-h-[90vh] overflow-y-auto"
          onEscapeKeyDown={(e) => {
            e.preventDefault();
            setEditEmployeeModalOpen(false);
            setEditingEmployee(null);
          }}
          onPointerDownOutside={(e) => {
            e.preventDefault();
            setEditEmployeeModalOpen(false);
            setEditingEmployee(null);
          }}
        >
          <DialogHeader>
            <DialogTitle>Edit Employee</DialogTitle>
            <DialogDescription>
              Update employee information. Changes will be saved immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* First Name and Last Name in grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            </div>

            {/* Email and Phone in grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            </div>

            {/* Role */}
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
                  <SelectItem value="videographer">Videographer</SelectItem>
                  <SelectItem value="scheduler">Scheduler</SelectItem>
                  <SelectItem value="qc">QC</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Hourly Rate and Hours Per Week in grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Hourly Rate ($)</label>
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
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Typical full-time: 40 hours/week
                </p>
              </div>
            </div>

            {/* Monthly Salary Preview */}
            {editEmployeeForm.hourlyRate && editEmployeeForm.hoursPerWeek && (
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

            {/* Hire Date and Employment Status in grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <div>
                <label className="text-sm font-medium">Employment Status</label>
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
            </div>

            <div className="flex justify-end gap-2 pt-2">
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
    </div>
  );
}
