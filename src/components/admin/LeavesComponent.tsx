"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import {  Card, CardContent, CardHeader, CardTitle  } from "@/components/ui/card";
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { toast } from "sonner";
import { Users, UserPlus, Search, MoreHorizontal, Mail, Phone, Calendar, Edit, Trash2, UserCheck, UserX, Filter } from 'lucide-react';



type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED";

interface LeaveRow {
  id: number;
  employeeId: number;
  employeeName: string;
  startDate: string; // yyyy-mm-dd
  endDate: string;   // yyyy-mm-dd
  reason: string;
  status: LeaveStatus;
  worksOnSaturday: boolean;
  createdAt?: string;
}

const roles = [
  { id: 'admin', name: 'Admin', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
  { id: 'manager', name: 'Manager', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
  { id: 'editor', name: 'Editor', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  { id: 'qc', name: 'QC Specialist', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  { id: 'scheduler', name: 'Scheduler', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
  { id: 'videographer', name: 'Videographer', color: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200' },
  { id: 'account-manager', name: 'Account Manager', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200' }
];

const statusOptions = [
  { id: 'active', name: 'Active', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  { id: 'inactive', name: 'Inactive', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200' },
  { id: 'on-leave', name: 'On Leave', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' }
];

// local api wrapper, no external import
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
    const day = d.getDay(); // 0 Sun, 6 Sat
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
  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);

  const [selectedLeave, setSelectedLeave] = useState<LeaveRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const loadLeaves = async () => {
    try {
      setLoading(true);
      const data = await apiFetch("/api/leave/list", { method: "GET" });

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

      setLeaves(rows);
    } catch (err: any) {
      console.error(err);
      toast("Error loading leaves", { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeaves();
  }, []);



 

  const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
    const [newUser, setNewUser] = useState({
      name: '',
      email: '',
      phone: '',
      role: '',
      status: 'active'
    });
    const [employees, setEmployees] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
  // FETCH EMPLOYEES FROM YOUR API
    // ------------------------------
    useEffect(() => {
  
      async function loadEmployees() {
        try {
          const res = await fetch("api/employee/management");
          const data = await res.json();
  
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
                    : "active",
                joinDate: u.joinedAt || null,
                lastActive: "N/A", // field not in DB
                tasksCompleted: tasksCount, // field not in DB
                avatar: initials
              };
            });
  
            setEmployees(formatted);
            
          }
        } catch (error) {
          console.error("Failed to fetch employees →", error);
        } finally {
          setLoading(false);
        }
      }
  
      loadEmployees();
    }, []);
  
    const filteredEmployees = employees.filter(employee => {
      const matchesSearch = employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           employee.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = roleFilter === 'all' || employee.role === roleFilter;
      const matchesStatus = statusFilter === 'all' || employee.status === statusFilter;
      
      return matchesSearch && matchesRole && matchesStatus;
    });
  
    const getRoleBadge = (roleId: string) => {
      const role = roles.find(r => r.id === roleId);
      return role ? (
        <Badge className={role.color}>
          {role.name}
        </Badge>
      ) : null;
    };
  
    const getStatusBadge = (statusId: string) => {
      const status = statusOptions.find(s => s.id === statusId);
      return status ? (
        <Badge className={status.color}>
          {status.name}
        </Badge>
      ) : null;
    };
  
    const handleAddUser = () => {
      setIsAddUserDialogOpen(false);
      setNewUser({ name: '', email: '', phone: '', role: '', status: 'active' });
    };
  
    const handleDeleteUser = (userId: number) => {
      console.log('Deleting user:', userId);
    };
  
    const handleUpdateUserStatus = (userId: number, newStatus: string) => {
      console.log('Updating user status:', userId, newStatus);
    };
  
    const roleStats = roles.map(role => ({
      ...role,
      count: employees.filter(emp => emp.role === role.id).length
    }));
  
    const statusStats = statusOptions.map(status => ({
      ...status,
      count: employees.filter(emp => emp.status === status.id).length
    }));

      const filteredLeaves = useMemo(() => {
    return leaves
      .filter((l) =>
        statusFilter === "ALL" ? true : l.status === statusFilter
      )
      .filter((l) => {
        if (!search.trim()) return true;
        const s = search.toLowerCase();
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
  }, [leaves, statusFilter, search, fromDate, toDate]);


     const totalPages = Math.max(1, Math.ceil(filteredLeaves.length / ITEMS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const paginatedLeaves = filteredLeaves.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleOpenDetails = (leave: LeaveRow) => {
    setSelectedLeave(leave);
    setDetailOpen(true);
  };

  const handleApprove = async (leave: LeaveRow) => {
    try {
      await apiFetch(`/api/leave/${leave.id}/approve`, {
        method: "PATCH",
      });
      toast("Leave approved", {
        description:
          "Deduction has been created for this leave and will be applied in payroll.",
      });
      setDetailOpen(false);
      await loadLeaves();
    } catch (err: any) {
      console.error(err);
      toast("Error approving leave", { description: err.message });
    }
  };

  const handleReject = async (leave: LeaveRow) => {
    try {
      await apiFetch(`/api/leave/${leave.id}/reject`, {
        method: "PATCH",
      });
      toast("Leave rejected");
      setDetailOpen(false);
      await loadLeaves();
    } catch (err: any) {
      console.error(err);
      toast("Error rejecting leave", { description: err.message });
    }
  };
  

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
            
            <Dialog open={isAddUserDialogOpen} onOpenChange={setIsAddUserDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add Employee
                </Button>
              </DialogTrigger>
              <DialogContent aria-describedby="add-employee-description">
                <DialogHeader>
                  <DialogTitle id="add-employee-title">Add New Employee</DialogTitle>
                  <DialogDescription id="add-employee-description">
                    Fill in the details below to add a new employee to the system.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm">Full Name</label>
                    <Input
                      value={newUser.name}
                      onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                      placeholder="Enter full name"
                    />
                  </div>
                  <div>
                    <label className="text-sm">Email</label>
                    <Input
                      type="email"
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                      placeholder="Enter email address"
                    />
                  </div>
                  <div>
                    <label className="text-sm">Phone</label>
                    <Input
                      value={newUser.phone}
                      onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                      placeholder="Enter phone number"
                    />
                  </div>
                  <div>
                    <label className="text-sm">Role</label>
                    <Select value={newUser.role} onValueChange={(value) => setNewUser({ ...newUser, role: value })}>
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
                  <div className="flex justify-end gap-3">
                    <Button variant="outline" onClick={() => setIsAddUserDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddUser}>
                      Add Employee
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

          {/* Employee Table */}
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
                          <div className="text-sm text-muted-foreground">{employee.email}</div>
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
                      {new Date(employee.joinDate).toLocaleDateString()}
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
                          <DropdownMenuItem>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleUpdateUserStatus(employee.id, employee.status === 'active' ? 'inactive' : 'active')}>
                            {employee.status === 'active' ? (
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
                              <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-red-600">
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Employee</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete {employee.name}? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteUser(employee.id)} className="bg-red-600 hover:bg-red-700">
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

      {/* Header + Filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Leave Management</h2>
          <p className="text-sm text-muted-foreground">
            Review and approve employee leave requests. Approved leaves
            automatically create salary deductions.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <Input
            className="w-48"
            placeholder="Search by employee/reason"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
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
            value={statusFilter}
            onValueChange={(v: any) => {
              setStatusFilter(v);
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
          {loading ? (
            <p className="p-4 text-sm text-muted-foreground">Loading...</p>
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
                          {formatDate(l.startDate)} →{" "}
                          {formatDate(l.endDate)}
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
                                onClick={() => handleApprove(l)}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
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

              {/* Pagination */}
              <div className="flex items-center justify-between px-4 py-2 border-t">
                <span className="text-xs text-muted-foreground">
                  Page {currentPage} of {totalPages} •{" "}
                  {filteredLeaves.length} total leaves
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
                    onClick={() =>
                      setPage((p) => Math.min(totalPages, p + 1))
                    }
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail Modal */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave Details</DialogTitle>
            <DialogDescription>
              Review the request before approving or rejecting. Approval will
              immediately create a salary deduction for this leave.
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
                <span className="text-muted-foreground block mb-1">
                  Reason
                </span>
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
