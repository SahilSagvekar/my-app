"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Calendar,
} from "lucide-react";
import { FileUploadDialog } from "../workflow/FileUploadDialog";
import { useAuth } from "../auth/AuthContext";

/* -------------------------------------------------------------------------- */
/* 🔥 STATUS + TYPE MAPPERS (BACKEND → UI FORMAT)                              */
/* -------------------------------------------------------------------------- */

function mapStatus(status: string) {
  switch (status) {
    case "PENDING":
      return "pending";
    case "IN_PROGRESS":
      return "in_progress";
    case "READY_FOR_QC":
      return "ready_for_qc";
    case "REJECTED":
      return "rejected";
    default:
      return "pending";
  }
}


function mapTaskTypeToWorkflow(type: string) {
  if (["design", "video", "copywriting"].includes(type)) return "edit";
  if (["review", "audit"].includes(type)) return "qc_review";
  if (["schedule"].includes(type)) return "scheduling";
  return "edit";
}

/* -------------------------------------------------------------------------- */
/* 🔥 WORKFLOW TASK TYPE EXPECTED BY UI                                       */
/* -------------------------------------------------------------------------- */


interface WorkflowTask {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  assignedTo: string;
  assignedToName: string;
  assignedToRole: string;
  createdAt: string;
  dueDate: string;
  workflowStep: string;
  clientId: string;          // 🔥 REQUIRED
  projectId: string;         // (same as clientId)
  files?: any[];
  rejectionReason?: string | null;
}

/* -------------------------------------------------------------------------- */
/* 🔥 TASK CARD COMPONENT                                                     */
/* -------------------------------------------------------------------------- */

function TaskCard({ task, onUploadComplete, onStartTask }: any) {
  const isOverdue = new Date(task.dueDate) < new Date();

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <h4 className="font-medium text-sm truncate">{task.title}</h4>
          <Badge
            variant={task.status === "completed" ? "default" : "secondary"}
            className="text-xs ml-2 flex-shrink-0"
          >
            {task.status.replace("_", " ")}
          </Badge>
        </div>

        <p className="text-sm text-muted-foreground mb-4 line-clamp-2 leading-relaxed">
          {task.description}
        </p>

        <div className="flex items-center justify-between mb-4">
          <span
            className={`text-xs ${
              isOverdue ? "text-red-500 font-medium" : "text-muted-foreground"
            }`}
          >
            Due {new Date(task.dueDate).toLocaleDateString()}
            {isOverdue && " (Overdue)"}
          </span>

          {task.files?.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {task.files.length} files
            </span>
          )}
        </div>

        {/* FILE LIST */}
        {task.files?.length > 0 && (
          <div className="mb-4 space-y-1">
            {task.files.map((file: any, i: number) => (
              <a
                key={i}
                href={file.url || file}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-xs text-blue-600 hover:underline"
              >
                📄 File {i + 1}
              </a>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          {(task.status === "pending" || task.status === "rejected") && (
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={onStartTask}
            >
              Start
            </Button>
          )}

          {task.status === "in_progress" && (
            <FileUploadDialog
              task={task}
              onUploadComplete={onUploadComplete}
              trigger={
                <Button size="sm" className="flex-1">
                  Upload & Complete
                </Button>
              }
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* 🔥 MAIN EDITOR DASHBOARD                                                   */
/* -------------------------------------------------------------------------- */

export function EditorDashboard() {
  const [tasks, setTasks] = useState<WorkflowTask[]>([]);
  const { user } = useAuth();

  const currentUser = {
    id: user?.id?.toString() || "",
    name: user?.name || "Editor",
    role: "editor",
  };

  /* ---------------------------- FETCH REAL DATA ---------------------------- */

  useEffect(() => {
    async function loadTasks() {
      try {
        const res = await fetch("/api/tasks");
        const data = await res.json();

        const formatted: WorkflowTask[] = (data.tasks || [])
          .filter((t: any) => t.assignedTo === Number(currentUser.id))
          .map((t: any) => ({
            id: t.id,
            title: t.title,
            description: t.description,
            type: mapTaskTypeToWorkflow(t.taskType),
            status: mapStatus(t.status),
            assignedTo: String(t.assignedTo),
            assignedToName: currentUser.name,
            assignedToRole: currentUser.role,
            createdAt: t.createdAt,
            dueDate: t.dueDate,
            folderType: t.folderType || "unknown",


            workflowStep: "editing",

            clientId: t.clientId,   // 🔥 FIXED
            projectId: t.clientId,  // 🔥 FIXED

            files: t.driveLinks || [],
            rejectionReason: t.rejectionReason || null,
          }));

        setTasks(formatted);
      } catch (err) {
        console.error("Failed to load tasks:", err);
      }
    }

    loadTasks();
  }, [currentUser.id]);

  /* ----------------------------- UPDATE STATUS ----------------------------- */

  async function startTask(taskId: string) {
    await fetch(`/api/tasks/${taskId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "IN_PROGRESS" }),
    });

    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: "in_progress" } : t))
    );
  }

  async function handleUploadComplete(taskId: string, files: any[]) {
    await fetch(`/api/tasks/${taskId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "READY_FOR_QC" }),
    });

    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, status: "completed", files } : t
      )
    );
  }

  /* ----------------------------- GROUPING ---------------------------------- */

  const tasksByStatus = {
    pending: tasks.filter((t) => t.status === "pending"),
    inProgress: tasks.filter((t) => t.status === "in_progress"),
    readyForQC: tasks.filter((t) => t.status === "ready_for_qc"),
    revisions: tasks.filter((t) => t.status === "rejected"),
  };


  const columns = [
    { id: "pending", title: "Pending", tasks: tasksByStatus.pending },
    { id: "inProgress", title: "In Progress", tasks: tasksByStatus.inProgress },
    { id: "readyForQC", title: "Ready for QC", tasks: tasksByStatus.readyForQC },
    { id: "revisions", title: "Revisions Needed", tasks: tasksByStatus.revisions },
  ];

  /* -------------------------------------------------------------------------- */

  return (
    <div className="space-y-6">
      <div>
        <h1>Editor Portal</h1>
        <p className="text-muted-foreground mt-2">
          Manage your assigned tasks and complete work for QC review
        </p>
      </div>

      <Card>
        <CardContent className="p-4">
          Logged in as: {currentUser.name}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {columns.map((column) => (
          <div key={column.id} className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b">
              <h3 className="font-medium">{column.title}</h3>
              <Badge variant="secondary" className="text-xs">
                {column.tasks.length}
              </Badge>
            </div>

            <div className="space-y-4 min-h-[400px]">
              {column.tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onUploadComplete={(files) =>
                    handleUploadComplete(task.id, files)
                  }
                  onStartTask={() => startTask(task.id)}
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
