"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
  DialogHeader,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

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
  const [loading, setLoading] = useState(false);

  const [statusFilter, setStatusFilter] = useState<"ALL" | LeaveStatus>("ALL");
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
