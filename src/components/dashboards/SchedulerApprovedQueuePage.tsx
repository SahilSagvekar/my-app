"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Calendar, Clock, FileText, Eye, Search, Filter, CheckCircle, MapPin } from 'lucide-react';

type SchedulerTask = {
  id: string;
  title: string;
  description?: string;
  priority: string;
  status: string;
  dueDate?: string;
  files: { id: string | number; name: string; url: string; size: number }[];
  createdAt: string;
  projectId: string;
  deliverable?: any;
};





export function SchedulerApprovedQueuePage() {
  const [tasks, setTasks] = useState<SchedulerTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<SchedulerTask | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  

  // Fetch tasks from backend
  useEffect(() => {
    loadTasks();
  }, []);

  console.log("Tasks:", selectedTask);

  async function loadTasks() {
    try {
      setLoading(true);
      const res = await fetch("/api/schedular/tasks", { cache: "no-store" });
      const data = await res.json();

      const mapped = data.tasks.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        priority: t.priority || "medium",
        status: "PENDING",
        dueDate: t.dueDate,
        files: (t.driveLinks || []).map((url, i) => ({
          id: i,
          name: url.split("/").pop(),
          url,
          size: 0
        })),
        createdAt: t.createdAt,
        projectId: t.clientId,
        deliverable: t.monthlyDeliverable
      }));

      setTasks(mapped);

      if (!selectedTask && mapped.length > 0) {
        setSelectedTask(mapped.find(t => t.status === "pending") || mapped[0]);
      }
    } finally {
      setLoading(false);
    }
  }

  async function scheduleTask(task: SchedulerTask) {
    try {
      setBusyId(task.id);

      const res = await fetch(`/api/tasks/${task.id}/mark-scheduled`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postedAt: new Date().toISOString() })
      });

      if (!res.ok) throw new Error("Failed to schedule");

      // Optimistic UI update
      setTasks(prev =>
        prev.map(t => t.id === task.id ? { ...t, status: "SCHEDULED" } : t)
      );

      setSelectedTask(null);

    } catch (err) {
      console.error(err);
      alert("Failed to schedule task");
    } finally {
      setBusyId(null);
    }
  }

  // async function scheduleTask(task) {
  //   try {
  //     setBusyId(task.id);

  //     await fetch(`/api/tasks/${task.id}/mark-scheduled`, {
  //       method: "PATCH",
  //       headers: { "Content-Type": "application/json" },
  //       body: JSON.stringify({ postedAt: new Date().toISOString() })
  //     });

  //     // Optimistic UI
  //     setTasks(prev => prev.map(t =>
  //       t.id === task.id ? { ...t, status: "completed" } : t
  //     ));

  //     setSelectedTask(null);
  //     alert("Task scheduled");
  //   } catch (err) {
  //     console.error(err);
  //     alert("Failed to schedule");
  //   } finally {
  //     setBusyId(null);
  //   }
  // }

  const formatFileSize = (bytes) => "N/A";

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "urgent": return "destructive";
      case "high": return "default";
      case "medium": return "secondary";
      default: return "outline";
    }
  };

  const filtered = tasks.filter(t => {
    const matchText = t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.id.toLowerCase().includes(searchTerm.toLowerCase());

    const matchPriority = priorityFilter === "all" || t.priority === priorityFilter;

    return matchText && matchPriority;
  });

  const pendingTasks = filtered.filter(t => t.status === "PENDING");
  const completedTasks = filtered.filter(t => t.status === "COMPLETED");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1>Approved Queue</h1>
        <p className="text-muted-foreground mt-2">
          QC-approved content ready for scheduling
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm">Pending</p>
            <h3>{pendingTasks.length}</h3>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-sm">Scheduled Today</p>
            <h3>{completedTasks.filter(t =>
              new Date(t.createdAt).toDateString() === new Date().toDateString()
            ).length}</h3>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-sm">Urgent</p>
            <h3>{pendingTasks.filter(t => t.priority === "urgent").length}</h3>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by title or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* MAIN LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* LEFT: Tasks */}
        <Card>
          <CardHeader>
            <CardTitle>Pending Tasks</CardTitle>
          </CardHeader>

          <CardContent className="p-0 max-h-[600px] overflow-y-auto">
            {pendingTasks.map(task => (
              <div
                key={task.id}
                className={`p-4 border-b cursor-pointer ${
                  selectedTask?.id === task.id ? "bg-muted" : ""
                }`}
                onClick={() => setSelectedTask(task)}
              >
                <div className="flex justify-between">
                  <h4>{task.title}</h4>
                  <Badge variant={getPriorityColor(task.priority)}>{task.priority}</Badge>
                </div>

                <p className="text-xs text-muted-foreground">
                  Due: {task.dueDate || "N/A"}
                </p>

                <Button
                  size="sm"
                  className="mt-3"
                  onClick={(e) => {
                    e.stopPropagation();
                    scheduleTask(task);
                  }}
                >
                  Schedule
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* RIGHT: Details */}
        <Card>
          <CardHeader>
            <CardTitle>Task Details</CardTitle>
          </CardHeader>

          <CardContent>
            {!selectedTask ? (
              <p className="text-muted-foreground">Select a task</p>
            ) : (
              <div className="space-y-4">

                <div>
                  <p className="font-medium">{selectedTask.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedTask.description}
                  </p>
                </div>

                {/* Deliverable */}
                <div className="p-4 border rounded">
                  <h4 className="font-medium mb-2">Deliverable</h4>
                  {selectedTask.deliverable ? (
                    <div className="text-sm">
                      <p>Type: {selectedTask.deliverable.type}</p>
                      <p>Schedule: {selectedTask.deliverable.postingSchedule}</p>
                      <p>Days: {selectedTask.deliverable.postingDays.join(", ")}</p>
                      <p>Times: {selectedTask.deliverable.postingTimes.join(", ")}</p>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No deliverable linked</p>
                  )}
                </div>

                {/* Files */}
                <div>
                  <h4 className="font-medium mb-2">Files</h4>
                  {selectedTask.files.map(file => (
                    <div key={file.id} className="border p-2 rounded flex justify-between">
                      <span>{file.name}</span>
                      <Button size="sm" variant="outline" onClick={() => window.open(file.url)}>
                        <Eye className="h-4 w-4 mr-1" /> View
                      </Button>
                    </div>
                  ))}
                </div>

                <Button
                  className="w-full"
                  onClick={() => scheduleTask(selectedTask)}
                  disabled={busyId === selectedTask.id}
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Schedule This Content
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
