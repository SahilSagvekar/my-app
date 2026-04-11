"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Avatar } from "../ui/avatar";
import { Clock, User, Share2 } from "lucide-react";
import { Button } from "../ui/button";
import { ShareDialog } from "../review/ShareDialog";
import { toast } from "sonner";
import { useAuth } from "../auth/AuthContext";

interface Task {
  id: string;
  title: string;
  description: string;
  taskType: string;
  assignedTo: number;
  dueDate: string;
  status: string;
  createdAt: string;
  oneOffDeliverableId?: string | null;
}

interface TasksResponse {
  tasks?: Task[];
  data?: Task[];
}

interface RecentTasksCardProps {
  title?: string;
  showCreateButton?: boolean;
  reloadKey?: number;
}

export function RecentTasksCard({
  title = "Recent Tasks",
  reloadKey = 0,
}: RecentTasksCardProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  // 🔥 Share states
  const [shareLink, setShareLink] = useState("");
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [, setIsSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const { user } = useAuth();

  const safeTasks = Array.isArray(tasks) ? tasks : [];

  useEffect(() => {
    if (!user) {
      setTasks([]);
      setLoading(false);
      return;
    }

    void loadTasks();
  }, [reloadKey, user?.id]);

  async function loadTasks() {
    try {
      const res = await fetch("/api/tasks", {
        credentials: "include",
      });
      const text = await res.text();
      const data = JSON.parse(text) as Task[] | TasksResponse;

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          console.warn("Recent tasks are unavailable for this session.");
        } else {
          console.error("Failed to load tasks:", data);
        }
        setTasks([]);
        return;
      }

      if (Array.isArray(data)) {
        setTasks(data);
        return;
      }

      if (Array.isArray(data.tasks)) {
        setTasks(data.tasks);
        return;
      }

      if (Array.isArray(data.data)) {
        setTasks(data.data);
        return;
      }

      console.warn("No tasks array in response:", data);
      setTasks([]);
    } catch (err) {
      console.error("❌ Failed to load tasks:", err);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }

  const handleShare = async (taskId: string) => {
    setIsSharing(true);
    setCopied(false);

    try {
      const res = await fetch(`/api/tasks/${taskId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expiresAt: null, // Never expires by default
        }),
      });

      if (!res.ok) throw new Error("Failed to generate share link");

      const data = await res.json();
      setShareLink(data.shareUrl);
      setShowShareDialog(true);

      // Auto-copy
      await navigator.clipboard.writeText(data.shareUrl);
      setCopied(true);
      toast.success("Share link created and copied to clipboard");
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate share link");
    } finally {
      setIsSharing(false);
    }
  };


  const formatRelativeTime = (dateString: string | null | undefined) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '—';
    const diff = (Date.now() - date.getTime()) / 3600000;

    if (diff < 1) return "Just now";
    if (diff < 24) return `${Math.floor(diff)}h ago`;
    return `${Math.floor(diff / 24)}d ago`;
  };

  const formatDue = (dateString: string | null | undefined) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '—';
    const diff = Math.ceil((date.getTime() - Date.now()) / 86400000);

    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    if (diff > 1) return `${diff} days left`;
    return `${Math.abs(diff)} days overdue`;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {title}
          </CardTitle>

          <Button size="sm" variant="outline" onClick={() => setShowAll(!showAll)}>
            {showAll ? "Show Less" : "View All"}
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {loading ? (
            <p className="text-center text-muted-foreground">Loading...</p>
          ) : tasks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <User className="h-12 w-12 mx-auto mb-4 opacity-40" />
              <p>No tasks yet</p>
            </div>
          ) : (

            (showAll ? safeTasks : safeTasks.slice(0, 5)).map((task) => (
              <div key={task.id} className="flex items-start gap-3 p-3 rounded-lg border">
                <Avatar className="h-8 w-8 mt-1">
                  {/* <AvatarFallback>
                    {task.assignedTo ? task.assignedTo.toString().slice(0, 2) : "?"}
                  </AvatarFallback> */}
                </Avatar>

                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">{task.title || "Untitled Task"}</h4>
                    <div className="flex items-center gap-2">
                      {task.oneOffDeliverableId && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1 bg-yellow-50 text-yellow-700 border-yellow-200">
                          One-Off
                        </Badge>
                      )}
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-primary"
                          onClick={() => handleShare(task.id)}
                        >
                          <Share2 className="h-3 w-3" />
                        </Button>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 uppercase">
                          {(task.status ?? '').replace(/_/g, " ")}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {task.taskType}
                  </p>

                  <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Due {formatDue(task.dueDate)}
                    </span>
                    <span>Created {formatRelativeTime(task.createdAt)}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>

      <ShareDialog
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
        shareLink={shareLink}
        onCopy={() => {
          navigator.clipboard.writeText(shareLink);
          setCopied(true);
          toast.success("Link copied to clipboard");
          setTimeout(() => setCopied(false), 2000);
        }}
        copied={copied}
      />
    </Card>
  );
}
