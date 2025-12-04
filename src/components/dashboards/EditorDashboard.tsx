"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Alert, AlertDescription } from "../ui/alert";
import {
  Calendar,
  FileText,
  Video,
  Image as ImageIcon,
  File,
  Download,
  Eye,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { FileUploadDialog } from "../workflow/FileUploadDialog";
import { useAuth } from "../auth/AuthContext";
import { useRouter } from "next/navigation";

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

interface TaskFile {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  uploadedBy: string;
}

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
  clientId: string;
  projectId: string;
  files?: TaskFile[];
  qcNotes?: string | null;
  rejectionReason?: string | null;
  feedback?: string | null;
}

/* -------------------------------------------------------------------------- */
/* 🔥 FILE PREVIEW COMPONENT                                                  */
/* -------------------------------------------------------------------------- */

function FilePreviewCard({ file, onView }: { file: TaskFile; onView: () => void }) {
  const getFileIcon = (mimeType: string) => {
    if (mimeType?.startsWith("video/"))
      return <Video className="h-4 w-4 text-blue-600" />;
    if (mimeType?.startsWith("image/"))
      return <ImageIcon className="h-4 w-4 text-green-600" />;
    if (mimeType?.includes("pdf"))
      return <FileText className="h-4 w-4 text-red-600" />;
    return <File className="h-4 w-4 text-gray-600" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div
      className="flex items-center gap-2 p-2 border rounded hover:bg-muted/50 transition-colors cursor-pointer group"
      onClick={onView}
    >
      <div className="p-1.5 bg-muted rounded">{getFileIcon(file.mimeType)}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{file.name}</p>
        <p className="text-xs text-muted-foreground">
          {formatFileSize(file.size)}
        </p>
      </div>
      <Eye className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 🔥 FILE VIEWER DIALOG                                                      */
/* -------------------------------------------------------------------------- */

function FileViewerDialog({
  files,
  open,
  onOpenChange,
}: {
  files: TaskFile[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const getFileIcon = (mimeType: string) => {
    if (mimeType?.startsWith("video/"))
      return <Video className="h-5 w-5 text-blue-600" />;
    if (mimeType?.startsWith("image/"))
      return <ImageIcon className="h-5 w-5 text-green-600" />;
    if (mimeType?.includes("pdf"))
      return <FileText className="h-5 w-5 text-red-600" />;
    return <File className="h-5 w-5 text-gray-600" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Task Files ({files.length})</DialogTitle>
        </DialogHeader>

        <div className="space-y-2 overflow-y-auto max-h-[60vh]">
          {files.map((file) => (
            <Card
              key={file.id}
              className="cursor-pointer hover:border-primary hover:shadow-sm transition-all"
              onClick={() => window.open(file.url, "_blank")}
            >
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-muted rounded">
                    {getFileIcon(file.mimeType)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{file.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatFileSize(file.size)}</span>
                      <span>•</span>
                      <span>
                        Uploaded {new Date(file.uploadedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <Button size="sm" variant="outline">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* 🔥 TASK CARD COMPONENT                                                     */
/* -------------------------------------------------------------------------- */

function TaskCard({ task, onUploadComplete, onStartTask }: any) {
  const [showFiles, setShowFiles] = useState(false);
  const isOverdue = new Date(task.dueDate) < new Date();

  return (
    <>
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

          {/* QC NOTES - Show for rejected tasks */}
          {
          // task.status === "rejected" && 
          task.qcNotes && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                <strong>QC Feedback:</strong>
                <p className="mt-1 whitespace-pre-wrap">{task.qcNotes}</p>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-center justify-between mb-4">
            <span
              className={`text-xs ${
                isOverdue
                  ? "text-red-500 font-medium"
                  : "text-muted-foreground"
              }`}
            >
              Due {new Date(task.dueDate).toLocaleDateString()}
              {isOverdue && " (Overdue)"}
            </span>

            {task.files?.length > 0 && (
              <Badge variant="outline" className="text-xs">
                <FileText className="h-3 w-3 mr-1" />
                {task.files.length} file{task.files.length !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>

          {/* FILE PREVIEWS */}
          {task.files && task.files.length > 0 && (
            <div className="mb-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">
                  Attached Files
                </p>
                {task.files.length > 2 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 text-xs"
                    onClick={() => setShowFiles(true)}
                  >
                    View all ({task.files.length})
                  </Button>
                )}
              </div>

              {/* Show first 2 files as preview */}
              <div className="space-y-1">
                {task.files.slice(0, 2).map((file: TaskFile) => (
                  <FilePreviewCard
                    key={file.id}
                    file={file}
                    onView={() => window.open(file.url, "_blank")}
                  />
                ))}
              </div>

              {/* Show "X more files" if there are more than 2 */}
              {task.files.length > 2 && (
                <button
                  className="text-xs text-primary hover:underline w-full text-left"
                  onClick={() => setShowFiles(true)}
                >
                  + {task.files.length - 2} more file
                  {task.files.length - 2 !== 1 ? "s" : ""}
                </button>
              )}
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
                {task.status === "rejected" ? "Start Revision" : "Start"}
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

      {/* File Viewer Dialog */}
      {task.files && task.files.length > 0 && (
        <FileViewerDialog
          files={task.files}
          open={showFiles}
          onOpenChange={setShowFiles}
        />
      )}
    </>
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

  const router = useRouter();

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
            clientId: t.clientId,
            projectId: t.clientId,
            files: t.files || [], // ✅ Now includes full file objects
            qcNotes: t.qcNotes || null, // ✅ QC feedback
            rejectionReason: t.rejectionReason || null,
            feedback: t.feedback || null,
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
    {
      id: "inProgress",
      title: "In Progress",
      tasks: tasksByStatus.inProgress,
    },
    {
      id: "readyForQC",
      title: "Ready for QC",
      tasks: tasksByStatus.readyForQC,
    },
    {
      id: "revisions",
      title: "Revisions Needed",
      tasks: tasksByStatus.revisions,
    },
  ];

  /* -------------------------------------------------------------------------- */

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1>Editor Portal</h1>
          <p className="text-muted-foreground mt-2">
            Manage your assigned tasks and complete work for QC review
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            className="w-full"
            onClick={() => router.push("/leave-request")}
          >
            Request Leave
          </Button>
        </div>
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