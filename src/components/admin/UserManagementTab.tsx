import { useState, useEffect } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Checkbox } from "../ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Users, UserCheck, UserX, Calendar, Search, UserMinus } from "lucide-react";

const fetcher = (url: string) => fetch(url).then(r => r.json());

const roles = [
  { id: "admin", name: "Admin", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
  { id: "manager", name: "Manager", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
  { id: "editor", name: "Editor", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  { id: "qc", name: "QC Specialist", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  { id: "scheduler", name: "Scheduler", color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" },
  { id: "videographer", name: "Videographer", color: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200" },
  { id: "sales", name: "Sales", color: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200" },
  { id: "sales_manager", name: "Sales Manager", color: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200" },
];

const statusOptions = [
  { id: "active", name: "Active", color: "bg-green-500 text-white dark:bg-green-600 dark:text-white" },
  { id: "inactive", name: "Inactive", color: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200" },
  { id: "on-leave", name: "On Leave", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
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

function formatDateMDY(value: string | null | undefined): string {
  if (!value) return "N/A";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "N/A";
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${mm}-${dd}-${yyyy}`;
}

function formatLastActive(value: string | null | undefined): string {
  if (!value) return "Never";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "Never";

  const now = new Date();
  const nowUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(),
                          now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds());
  const valueUtc = d.getTime();

  const diffMs = nowUtc - valueUtc;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 0) return "Active now";
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;

  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${mm}-${dd}-${yyyy}`;
}

export function UserManagementTab() {
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [clientsCount, setClientsCount] = useState(0);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [terminating, setTerminating] = useState(false);

  // Second-round state: when some selected people have active tasks and
  // need a fallback assignee before they can be terminated.
  const [needsReassignment, setNeedsReassignment] = useState<{ id: number; name: string | null; activeTaskCount: number }[]>([]);
  const [reassignTo, setReassignTo] = useState<string>("");

  // 🔥 Note: /api/employee/list excludes TERMINATED people by default now —
  // this list, and every other picker/dropdown in the app that uses it,
  // naturally stops showing someone once they're terminated.
  const { data: empData, mutate } = useSWR("/api/employee/list", fetcher, {
    dedupingInterval: 300000,
    revalidateOnFocus: false,
  });

  useEffect(() => {
    fetch("/api/clients/count")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.count != null) setClientsCount(d.count); })
      .catch(() => {
        fetch("/api/clients")
          .then(r => r.json())
          .then(d => { if (d.clients) setClientsCount(d.clients.length); })
          .catch(() => {});
      });
  }, []);

  const employeesList: Employee[] = (empData?.employees || []).map((u: any) => {
    const initials = u.name?.trim()
      ? u.name.split(" ").map((n: string) => n[0]).join("")
      : "U";
    return {
      id: u.id,
      name: u.name || "No Name",
      email: u.email,
      phone: "N/A",
      role: u.role,
      status: u.employeeStatus === "ACTIVE" ? "active" : u.employeeStatus === "INACTIVE" ? "inactive" : "active",
      joinDate: formatDateMDY(u.joinedAt || null),
      lastActive: formatLastActive(u.lastActive),
      tasksCompleted: 0,
      avatar: initials,
    };
  });

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

  // ── Selection ──────────────────────────────────────────────────────────
  const allVisibleSelected = filteredEmployees.length > 0 && filteredEmployees.every((e) => selectedIds.has(e.id));

  const toggleAll = () => {
    setSelectedIds((prev) => {
      if (allVisibleSelected) {
        const next = new Set(prev);
        filteredEmployees.forEach((e) => next.delete(e.id));
        return next;
      }
      const next = new Set(prev);
      filteredEmployees.forEach((e) => next.add(e.id));
      return next;
    });
  };

  const toggleOne = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Bulk terminate ────────────────────────────────────────────────────
  const runBulkTerminate = async (employeeIds: number[], reassignAllToId?: number) => {
    setTerminating(true);
    try {
      const res = await fetch("/api/employee/bulk-terminate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeIds,
          ...(reassignAllToId ? { reassignAllTo: reassignAllToId } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message || "Failed to terminate");

      if (data.terminated.length > 0) {
        toast.success(`Terminated ${data.terminated.length} account${data.terminated.length !== 1 ? "s" : ""}`);
      }
      if (data.alreadyTerminated.length > 0) {
        toast.info(`${data.alreadyTerminated.length} were already terminated`);
      }
      if (data.needsReassignment.length > 0) {
        // First pass found people with active tasks — ask for a fallback
        // assignee and let the admin retry just for those.
        setNeedsReassignment(data.needsReassignment);
      } else {
        setNeedsReassignment([]);
      }

      setSelectedIds(new Set());
      mutate();
    } catch (err: any) {
      toast.error("Failed to terminate", { description: err.message });
    } finally {
      setTerminating(false);
    }
  };

  const handleConfirmTerminate = () => {
    setConfirmOpen(false);
    runBulkTerminate(Array.from(selectedIds));
  };

  const handleResolveReassignment = () => {
    if (!reassignTo) return;
    runBulkTerminate(needsReassignment.map((n) => n.id), Number(reassignTo));
    setReassignTo("");
  };

  // People eligible to receive reassigned tasks — active, not one of the
  // people currently stuck needing reassignment.
  const reassignmentCandidates = employeesList.filter(
    (e) => e.status === "active" && !needsReassignment.some((n) => n.id === e.id)
  );

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
                <div key={role.id} className="flex items-center justify-between">
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
                <div key={status.id} className="flex items-center justify-between">
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

      {/* Employee table */}
      <Card>
        <CardHeader className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle>Employees</CardTitle>
            {selectedIds.size > 0 && (
              <Button
                variant="destructive"
                size="sm"
                className="gap-1.5"
                onClick={() => setConfirmOpen(true)}
                disabled={terminating}
              >
                <UserMinus className="h-3.5 w-3.5" />
                Terminate Selected ({selectedIds.size})
              </Button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email…"
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {statusOptions.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-3 w-8">
                    <Checkbox checked={allVisibleSelected} onCheckedChange={toggleAll} />
                  </th>
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Email</th>
                  <th className="py-2 pr-3">Role</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Joined</th>
                  <th className="py-2 pr-3">Last Active</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((employee) => (
                  <tr key={employee.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="py-2 pr-3">
                      <Checkbox
                        checked={selectedIds.has(employee.id)}
                        onCheckedChange={() => toggleOne(employee.id)}
                      />
                    </td>
                    <td className="py-2 pr-3 font-medium">{employee.name}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{employee.email}</td>
                    <td className="py-2 pr-3">{getRoleBadge(employee.role)}</td>
                    <td className="py-2 pr-3">{getStatusBadge(employee.status)}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{employee.joinDate}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{employee.lastActive}</td>
                  </tr>
                ))}
                {filteredEmployees.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">
                      No employees match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Confirm bulk terminate */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Terminate {selectedIds.size} account{selectedIds.size !== 1 ? "s" : ""}?</AlertDialogTitle>
            <AlertDialogDescription>
              Terminated accounts disappear from assignment pickers and lists across the app.
              Their history (past tasks, invoices, documents) is kept — this isn't a hard delete.
              If anyone selected has tasks currently in progress, you'll be asked to pick someone
              to reassign those to before they can be terminated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmTerminate} className="bg-red-600 hover:bg-red-700">
              Terminate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reassignment needed for people with active tasks */}
      <AlertDialog open={needsReassignment.length > 0} onOpenChange={(open) => { if (!open) setNeedsReassignment([]); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Active tasks need reassignment first</AlertDialogTitle>
            <AlertDialogDescription>
              {needsReassignment.map((n) => n.name || `#${n.id}`).join(", ")} currently{" "}
              {needsReassignment.length === 1 ? "has" : "have"} active tasks and can't be terminated
              until those are reassigned. Pick someone to take over all of them, or cancel and handle
              it individually.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Select value={reassignTo} onValueChange={setReassignTo}>
              <SelectTrigger>
                <SelectValue placeholder="Reassign all their tasks to…" />
              </SelectTrigger>
              <SelectContent>
                {reassignmentCandidates.map((e) => (
                  <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setNeedsReassignment([])}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleResolveReassignment} disabled={!reassignTo || terminating}>
              Reassign &amp; Terminate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}