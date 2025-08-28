"use client";

import React, { useMemo } from "react";
import useSWR from "swr";
import { useSWRConfig } from "swr";
import { fetcher } from "@/lib/fetcher";

import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Button } from "../ui/button";
import { Calendar, Paperclip, Upload, Clock, CheckCircle, AlertTriangle } from "lucide-react";
import { FileUploadDialog } from "../workflow/FileUploadDialog";
import { useTaskWorkflow } from "../workflow/TaskWorkflowEngine";
import { useGlobalTasks } from "../workflow/GlobalTaskManager";
import { useAuth } from "../auth/AuthContext";

type WorkflowTask = {
  id: string;
  title: string;
  description?: string | null;
  type?: string;
  status: string;
  assignedTo?: string | null;
  assignedToName?: string | null;
  assignedToRole?: string | null;
  createdAt: string | Date;
  dueDate?: string | Date | null;
  workflowStep?: string | null;
  projectId?: string | null;
  parentTaskId?: string | null;
  files?: any[] | null;
  feedback?: string | null;
  rejectionReason?: string | null;
  originalTaskId?: string | null;
};

const UI_TRANSITIONS: Record<string, { label: string; next: string }[]> = {
  PENDING: [{ label: "Start Task", next: "IN_PROGRESS" }],
  IN_PROGRESS: [
    { label: "Mark Ready for QC", next: "READY_FOR_QC" },
    { label: "Put On Hold", next: "ON_HOLD" },
  ],
  READY_FOR_QC: [{ label: "Start QC", next: "QC_IN_PROGRESS" }],
  QC_IN_PROGRESS: [
    { label: "Approve", next: "COMPLETED" },
    { label: "Reject (Back to Editor)", next: "REJECTED" },
  ],
};

function fmtDate(d?: string | Date | null) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString();
}

function TaskCard({
  task,
  currentUserRole,
  onAction,
}: {
  task: WorkflowTask;
  currentUserRole: string | undefined;
  onAction: (taskId: string, nextStatus: string, files?: any[]) => void;
}) {
  const cur = (task.status || "").toString().toUpperCase();
  const isRevision = task.id.startsWith("REV-");
  const isOverdue = task.dueDate ? new Date(task.dueDate as any) < new Date() : false;

  const getStatusIcon = () => {
    switch (cur) {
      case "COMPLETED":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "IN_PROGRESS":
        return <Clock className="h-4 w-4 text-blue-500" />;
      case "PENDING":
        return <Calendar className="h-4 w-4 text-muted-foreground" />;
      default:
        return null;
    }
  };

  const availableActions = UI_TRANSITIONS[cur] ?? [];

  // Filter actions based on role (same rules as server; server still enforces)
  const visibleActions = availableActions.filter((a) => {
    if (!currentUserRole) return false;
    if (currentUserRole === "manager" || currentUserRole === "admin") return true;
    if (currentUserRole === "editor") {
      return (cur === "PENDING" && a.next === "IN_PROGRESS") ||
             (cur === "IN_PROGRESS" && a.next === "READY_FOR_QC");
    }
    if (currentUserRole === "qc") {
      return (cur === "READY_FOR_QC" && a.next === "QC_IN_PROGRESS") ||
             (cur === "QC_IN_PROGRESS" && (a.next === "COMPLETED" || a.next === "REJECTED"));
    }
    return false;
  });

  return (
    <Card className={`${isRevision ? "border-orange-200 bg-orange-50/50" : ""} ${isOverdue ? "border-red-200" : ""} hover:shadow-md transition-shadow`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {getStatusIcon()}
            <h4 className="font-medium text-sm truncate">{task.title}</h4>
          </div>
          <Badge variant={cur === "COMPLETED" ? "default" : "secondary"} className="text-xs ml-2 flex-shrink-0">
            {String(cur).replace("_", " ")}
          </Badge>
        </div>

        {isRevision && task.rejectionReason && (
          <div className="mb-3 p-2 bg-orange-100 rounded-md">
            <div className="flex items-center gap-1 mb-1">
              <AlertTriangle className="h-3 w-3 text-orange-600" />
              <span className="text-xs font-medium text-orange-800">Revision Required</span>
            </div>
            <p className="text-xs text-orange-700">{task.rejectionReason}</p>
          </div>
        )}

        {task.description && (
          <p className="text-sm text-muted-foreground mb-4 line-clamp-2 leading-relaxed">{task.description}</p>
        )}

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src="" />
              <AvatarFallback className="text-xs">{task.assignedToName?.slice(0, 2).toUpperCase() || "ED"}</AvatarFallback>
            </Avatar>
            <span className={`text-xs ${isOverdue ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
              Due {fmtDate(task.dueDate)}
              {isOverdue && " (Overdue)"}
            </span>
          </div>

          {Array.isArray(task.files) && task.files.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Paperclip className="h-3 w-3" />
              <span>{task.files.length}</span>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="flex-1" onClick={() => console.log("View task details:", task.id)}>
            View Details
          </Button>

          {visibleActions.map((a) => (
            <Button
              key={a.next}
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => onAction(task.id, a.next)}
            >
              {a.label}
            </Button>
          ))}

          {/* If in progress, show direct Upload dialog that will call onAction(taskId, 'READY_FOR_QC', files) */}
          {cur === "IN_PROGRESS" && (
            <FileUploadDialog
              task={task as any}
              onUploadComplete={(files) => onAction(task.id, "READY_FOR_QC", files)}
              trigger={
                <Button size="sm" className="flex-1">
                  <Upload className="h-3 w-3 mr-1" /> Complete
                </Button>
              }
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function EditorDashboard({ initialTasks = [] as WorkflowTask[] }) {
  const { user } = useAuth();
  const currentUser = {
    id: user?.id || "ed2",
    name: user?.name || "Editor User",
    role: user?.role || "editor",
  };

  const { data, error, isLoading, mutate: mutateTasks } = useSWR<{ tasks: WorkflowTask[] }>(
    "/api/tasks/assigned ",
    fetcher,
    { fallbackData: { tasks: initialTasks }, revalidateOnFocus: true, refreshInterval: 10000 }
  );

  const tasks = data?.tasks ?? [];

  // grouping
  const tasksByStatus = useMemo(() => ({
    pending: tasks.filter((t) => t.status === "PENDING" || t.status === "pending"),
    inProgress: tasks.filter((t) => t.status === "IN_PROGRESS" || t.status === "in_progress"),
    readyForQC: tasks.filter((t) => t.status === "READY_FOR_QC" || t.status === "ready_for_qc" || t.status === "completed"), // optionally treat completed as ready for QC if your shape differs
    revisions: tasks.filter((t) => t.id.startsWith("REV-") && (t.status === "PENDING" || t.status === "pending")),
  }), [tasks]);

  const columns = [
    { id: "pending", title: "Pending", tasks: tasksByStatus.pending, color: "text-gray-600" },
    { id: "inProgress", title: "In Progress", tasks: tasksByStatus.inProgress, color: "text-blue-600" },
    { id: "readyForQC", title: "Ready for QC", tasks: tasksByStatus.readyForQC, color: "text-green-600" },
    { id: "revisions", title: "Revisions Needed", tasks: tasksByStatus.revisions, color: "text-orange-600" },
  ];

  // optimistic update helper
  const optimisticUpdate = (id: string, patch: Partial<WorkflowTask>) =>
    mutateTasks((prev) => {
      if (!prev?.tasks) return prev;
      return { tasks: prev.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) };
    }, false);

  // Generic transition that the UI calls
  const doTransition = async (taskId: string, nextStatus: string, files?: any[]) => {
    // Uppercase server enum style
    const normalized = nextStatus.toString().toUpperCase();

    // Optimistically update UI
    optimisticUpdate(taskId, { status: normalized, ...(files ? { files } : {}) });

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: normalized, files }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to update task");
      }

      // Revalidate from the server source of truth
      await mutateTasks();
    } catch (err) {
      console.error("Transition failed:", err);
      // rollback by revalidating - server will return authoritative state
      await mutateTasks();
      // show UI toast here if you have one
    }
  };

  const handleUploadComplete = async (taskId: string, files: any[]) => {
    // Use doTransition to mark READY_FOR_QC and include files metadata
    await doTransition(taskId, "READY_FOR_QC", files);
  };

  const totalTasks = tasks.length;
  const todayStr = new Date().toDateString();
  const completedToday = (tasksByStatus.readyForQC || []).filter((t) => new Date(t.createdAt as any).toDateString() === todayStr).length;
  const overdueTasks = tasks.filter((t) => t.dueDate && new Date(t.dueDate as any) < new Date() && String(t.status).toUpperCase() !== "COMPLETED").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1>Editor Portal</h1>
          <p className="text-muted-foreground mt-2">Manage your assigned tasks and complete work for QC review</p>
        </div>
        <div className="text-sm text-muted-foreground">
          Logged in as: {currentUser.name} (ID: {currentUser.id}) | Role: {currentUser.role}
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Tasks</p>
                <h3>{totalTasks}</h3>
              </div>
              <Calendar className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed Today</p>
                <h3>{completedToday}</h3>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Overdue</p>
                <h3 className="text-red-500">{overdueTasks}</h3>
              </div>
              <Clock className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Workflow info */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Upload className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h4 className="font-medium">Automated Workflow</h4>
              <p className="text-sm text-muted-foreground">When you complete a task and upload files, a QC review task is automatically created. If approved, it goes to scheduling. If rejected, you'll get a revision task.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Kanban */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {columns.map((column) => (
          <div key={column.id} className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b">
              <h3 className={`font-medium ${column.color}`}>{column.title}</h3>
              <Badge variant="secondary" className="text-xs">{column.tasks.length}</Badge>
            </div>

            <div className="space-y-4 min-h-[400px]">
              {column.tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  currentUserRole={currentUser.role}
                  onAction={(taskId, nextStatus, files) => {
                    if (nextStatus === "READY_FOR_QC" && files) {
                      handleUploadComplete(taskId, files);
                    } else {
                      doTransition(taskId, nextStatus, files);
                    }
                  }}
                />
              ))}

              {column.tasks.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">No tasks</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
