"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Clock, User } from "lucide-react";
import { Button } from "../ui/button";

interface Task {
  id: string;
  title: string;
  type: string;
  assignedTo: {
    name: string;
    avatar: string;
    role: string;
  } | null;
  dueDate: string;
  status: "pending" | "in_progress" | "completed";
  createdAt: string;
}

const statusColors = {
  pending: "bg-yellow-100 text-yellow-800",
  in_progress: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
};

const formatRelativeTime = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60)
  );

  if (diffInHours < 1) return "Just now";
  if (diffInHours < 24) return `${diffInHours}h ago`;

  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays}d ago`;
};

const formatDueDate = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInDays = Math.ceil(
    (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffInDays === 0) return "Today";
  if (diffInDays === 1) return "Tomorrow";
  if (diffInDays > 0) return `${diffInDays} days left`;
  return `${Math.abs(diffInDays)} days overdue`;
};

interface RecentTasksCardProps {
  title?: string;
  showCreateButton?: boolean;
  onCreateTask?: (newTask: Task) => void; // optional callback for task creation
}

export function RecentTasksCard({
  title = "Recent Tasks",
  showCreateButton = false,
  onCreateTask,
}: RecentTasksCardProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false); // New state to toggle view all

  // 1️⃣ Fetch tasks from API when component mounts
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const res = await fetch("/api/tasks");
        const data = await res.json();
        setTasks(data);
      } catch (error) {
        console.error("Error fetching tasks", error);
      } finally {
        setLoading(false);
      }
    };
    fetchTasks();
  }, []);

  // 2️⃣ Function to handle adding a new task
  const handleAddTask = (newTask: Task) => {
    // Add the new task to the top of the list instantly
    setTasks((prev) => [newTask, ...prev]);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {title}
          </CardTitle>

          {showCreateButton && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (onCreateTask) {
                  onCreateTask?.(handleAddTask as any); // pass callback
                } else {
                  setShowAll(!showAll); // toggle view all if no create button logic
                }
              }}
            >
              {showAll ? "Show Less" : "View All"}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {loading ? (
            <p className="text-center text-muted-foreground">Loading...</p>
          ) : tasks.length > 0 ? (
            // 3️⃣ Slice tasks to show only first 5 unless showAll is true
            (showAll ? tasks : tasks.slice(0, 5)).map((task) => (
              <div
                key={task.id}
                className="flex items-start gap-3 p-3 rounded-lg border"
              >
                <Avatar className="h-8 w-8 mt-1">
                  <AvatarImage src="" />
                  <AvatarFallback>{task.assignedTo?.avatar || "?"}</AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <h4 className="text-sm font-medium line-clamp-1">{task.title}</h4>
                      <p className="text-xs text-muted-foreground">
                        Assigned to {task.assignedTo?.name || "Unassigned"}
                      </p>
                    </div>

                    <Badge
                      variant="secondary"
                      className={`text-xs ${
                        statusColors[task.status as keyof typeof statusColors] || ""
                      }`}
                    >
                      {task.status ? task.status.replace("_", " ") : "No Status"}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Due {formatDueDate(task.dueDate)}
                    </div>
                    <span>Created {formatRelativeTime(task.createdAt)}</span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <User className="h-12 w-12 mx-auto mb-4 opacity-40" />
              <p>No recent tasks</p>
              <p className="text-sm">Tasks created will appear here</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
