"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Clock, User } from "lucide-react";
import { Button } from "../ui/button";

interface Task {
  id: string;
  title: string;
  description: string;
  taskType: string;
  assignedTo: number;
  dueDate: string;
  status: string;
  createdAt: string;
}

export function RecentTasksCard({ title = "Recent Tasks", showCreateButton = false }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const safeTasks = Array.isArray(tasks) ? tasks : [];

  useEffect(() => {
    loadTasks();
  }, []);

  async function loadTasks() {
  try {
    const res = await fetch("/api/tasks");
    const text = await res.text(); // read raw text (debug friendly)

    let data: any = {};
    try {
      data = JSON.parse(text);
    } catch {
      console.error("❌ Invalid JSON from /api/tasks:", text);
      setTasks([]);
      return;
    }

    let list = [];

    if (Array.isArray(data)) list = data;
    else if (Array.isArray(data.tasks)) list = data.tasks;
    else if (Array.isArray(data.data)) list = data.data;
    else {
      console.warn("⚠ No tasks array in response:", data);
      list = [];
    }

    setTasks(list);
  } catch (err) {
    console.error("❌ Failed to load tasks:", err);
    setTasks([]);
  } finally {
    setLoading(false);
  }
}


  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const diff = (Date.now() - date.getTime()) / 3600000;

    if (diff < 1) return "Just now";
    if (diff < 24) return `${Math.floor(diff)}h ago`;
    return `${Math.floor(diff / 24)}d ago`;
  };

  const formatDue = (dateString: string) => {
    const date = new Date(dateString);
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
                  <AvatarFallback>
                    {task.assignedTo ? task.assignedTo.toString().slice(0, 2) : "?"}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">{task.title || "Untitled Task"}</h4>
                    <Badge variant="secondary" className="text-xs">
                      {task.status}
                    </Badge>
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
    </Card>
  );
}
