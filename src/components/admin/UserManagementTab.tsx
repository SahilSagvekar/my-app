import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Users, UserCheck, UserX, Calendar } from "lucide-react";

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
  {
    id: "sales",
    name: "Sales",
    color: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
  },
];

const statusOptions = [
  {
    id: "active",
    name: "Active",
    color: "bg-green-500 text-white dark:bg-green-600 dark:text-white",
  },
  {
    id: "inactive",
    name: "Inactive",
    color: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  },
  {
    id: "on-leave",
    name: "On Leave",
    color:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  },
];

interface Employee {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: string;
  status: string;
  joinDate: string;
  lastActive: string;
  tasksCompleted: number;
  avatar: string;
}

interface EmployeeApiResponse {
  ok: boolean;
  employees: Array<{
    id: number;
    name: string;
    email: string;
    role: string;
    employeeStatus: string;
    joinedAt: string;
    lastActive: string | null;
  }>;
}

function formatDateMDY(value: string | null | undefined): string {
  if (!value) return "N/A";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "N/A";
  // Use UTC methods
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${mm}-${dd}-${yyyy}`;
}

function formatLastActive(value: string | null | undefined): string {
  if (!value) return "Never";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "Never";
  
  // Use UTC time for comparison
  const now = new Date();
  const nowUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 
                          now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds());
  const valueUtc = d.getTime(); // Already in UTC if ISO string
  
  const diffMs = nowUtc - valueUtc;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffMins < 0) return "Active now"; // Future session
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  
  // For older dates, show the actual date in UTC
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${mm}-${dd}-${yyyy}`;
}

export function UserManagementTab() {
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [employeesList, setEmployeesList] = useState<Employee[]>([]);
  const [clientsCount, setClientsCount] = useState(0);

  useEffect(() => {
    async function loadEmployees() {
      try {
        const res = await fetch("api/employee/list");
        const data: EmployeeApiResponse = await res.json();

        if (data.ok) {
          const formatted: Employee[] = data.employees.map((u) => {
            const initials =
              u.name && u.name.trim() !== ""
                ? u.name
                  .split(" ")
                  .map((n: string) => n[0])
                  .join("")
                : "U";

            return {
              id: u.id,
              name: u.name || "No Name",
              email: u.email,
              phone: "N/A",
              role: u.role,
              status:
                u.employeeStatus === "ACTIVE"
                  ? "active"
                  : u.employeeStatus === "INACTIVE"
                    ? "inactive"
                    : "active",
              joinDate: formatDateMDY(u.joinedAt || null),
              lastActive: formatLastActive(u.lastActive),
              tasksCompleted: 0,
              avatar: initials,
            };
          });

          setEmployeesList(formatted);
        }
      } catch (error) {
        console.error("Failed to fetch employees →", error);
      }
    }

    async function loadClientsCount() {
      try {
        const res = await fetch("/api/clients");
        const data = await res.json();
        if (data.clients && Array.isArray(data.clients)) {
          setClientsCount(data.clients.length);
        }
      } catch (error) {
        console.error("Failed to fetch clients count →", error);
      }
    }

    loadEmployees();
    loadClientsCount();
  }, []);

  const filteredEmployees = employeesList.filter((employee) => {
    const matchesSearch =
      employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === "all" || employee.role === roleFilter;
    const matchesStatus =
      statusFilter === "all" || employee.status === statusFilter;

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

  const roleStats = roles.map((role) => ({
    ...role,
    count: employeesList.filter((emp) => emp.role === role.id).length,
  }));

  const statusStats = statusOptions.map((status) => ({
    ...status,
    count: employeesList.filter((emp) => emp.status === status.id).length,
  }));

  // Use filteredEmployees, getRoleBadge, getStatusBadge to prevent unused variable warnings
  console.log({ filteredEmployees, getRoleBadge, getStatusBadge });

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6 flex flex-col items-center justify-center text-center">
            <Users className="h-8 w-8 text-blue-600 mb-4" />
            <p className="text-sm text-muted-foreground">Total Employees</p>
            <h3 className="text-3xl font-bold mt-1">{employeesList.length}</h3>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 flex flex-col items-center justify-center text-center">
            <UserCheck className="h-8 w-8 text-green-600 mb-4" />
            <p className="text-sm text-muted-foreground">Active Users</p>
            <h3 className="text-3xl font-bold mt-1">
              {employeesList.filter((emp) => emp.status === "active").length}
            </h3>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 flex flex-col items-center justify-center text-center">
            <Calendar className="h-8 w-8 text-orange-600 mb-4" />
            <p className="text-sm text-muted-foreground">On Leave</p>
            <h3 className="text-3xl font-bold mt-1">
              {employeesList.filter((emp) => emp.status === "on-leave").length}
            </h3>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 flex flex-col items-center justify-center text-center">
            <UserX className="h-8 w-8 text-red-600 mb-4" />
            <p className="text-sm text-muted-foreground">Inactive</p>
            <h3 className="text-3xl font-bold mt-1">
              {employeesList.filter((emp) => emp.status === "inactive").length}
            </h3>
          </CardContent>
        </Card>
      </div>

      {/* Role Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Role Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {roleStats.map((role) => (
                <div
                  key={role.id}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <Badge className={role.color}>{role.name}</Badge>
                  </div>
                  <span className="font-medium">{role.count}</span>
                </div>
              ))}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge className="bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200">
                    Clients
                  </Badge>
                </div>
                <span className="font-medium">{clientsCount}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {statusStats.map((status) => (
                <div
                  key={status.id}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <Badge className={status.color}>{status.name}</Badge>
                  </div>
                  <span className="font-medium">{status.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}