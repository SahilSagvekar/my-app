"use client";

import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  User,
  Users,
  FileText,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';

interface ActiveTask {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  deliverableType: string;
  clientName: string;
  clientId: string;
}

interface Candidate {
  id: number;
  name: string;
  email: string;
  activeTaskCount: number;
}

interface UserInfo {
  id: number;
  name: string;
  role: string;
}

interface TaskReassignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: number;
  onDeactivated: () => void; // callback after successful deactivation
}

const STATUS_STYLES: Record<string, string> = {
  'PENDING': 'bg-blue-100 text-blue-700',
  'IN_PROGRESS': 'bg-yellow-100 text-yellow-700',
  'REJECTED': 'bg-red-100 text-red-700',
  'READY_FOR_QC': 'bg-green-100 text-green-700',
};

export function TaskReassignmentDialog({
  open,
  onOpenChange,
  employeeId,
  onDeactivated,
}: TaskReassignmentDialogProps) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [tasks, setTasks] = useState<ActiveTask[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);

  // Reassignment state: taskId -> assigneeId
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  // Bulk assign
  const [bulkAssignee, setBulkAssignee] = useState<string>('');

  useEffect(() => {
    if (open && employeeId) {
      fetchData();
    }
  }, [open, employeeId]);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch(`/api/employee/${employeeId}/active-tasks`);
      const data = await res.json();

      if (!data.ok) {
        toast.error(data.message || 'Failed to fetch tasks');
        onOpenChange(false);
        return;
      }

      setUserInfo(data.user);
      setTasks(data.tasks);
      setCandidates(data.candidates);
      setAssignments({});
      setBulkAssignee('');
    } catch (err) {
      console.error(err);
      toast.error('Failed to fetch active tasks');
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  }

  // Apply bulk assignee to all tasks
  function handleBulkAssign(candidateId: string) {
    setBulkAssignee(candidateId);
    if (candidateId) {
      const newAssignments: Record<string, string> = {};
      tasks.forEach(t => { newAssignments[t.id] = candidateId; });
      setAssignments(newAssignments);
    }
  }

  // Set individual assignment
  function handleTaskAssign(taskId: string, candidateId: string) {
    setAssignments(prev => ({ ...prev, [taskId]: candidateId }));
    // Clear bulk if individual differs
    setBulkAssignee('');
  }

  // Check if all tasks are assigned
  const allAssigned = useMemo(() => {
    return tasks.every(t => assignments[t.id]);
  }, [tasks, assignments]);

  const assignedCount = useMemo(() => {
    return tasks.filter(t => assignments[t.id]).length;
  }, [tasks, assignments]);

  // Submit
  async function handleSubmit() {
    if (!allAssigned) {
      toast.error('Please assign all tasks before deactivating');
      return;
    }

    setSubmitting(true);
    try {
      // Check if all go to same person (use bulk for efficiency)
      const assigneeIds = new Set(Object.values(assignments));
      const isBulk = assigneeIds.size === 1;

      const body = isBulk
        ? { reassignAllTo: Number([...assigneeIds][0]) }
        : {
            reassignments: tasks.map(t => ({
              taskId: t.id,
              newAssigneeId: Number(assignments[t.id]),
            })),
          };

      const res = await fetch(`/api/employee/${employeeId}/deactivate-with-reassign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!data.ok) {
        toast.error(data.message || 'Failed to deactivate');
        return;
      }

      toast.success(
        `${userInfo?.name} deactivated. ${data.reassignedCount} task(s) reassigned.`
      );
      onOpenChange(false);
      onDeactivated();
    } catch (err) {
      console.error(err);
      toast.error('Failed to deactivate user');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Reassign Tasks Before Deactivating
          </DialogTitle>
          <DialogDescription>
            {userInfo
              ? `${userInfo.name} has ${tasks.length} active task(s). Reassign them to other ${userInfo.role}s before deactivating.`
              : 'Loading...'}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex flex-col gap-4 overflow-hidden">
            {/* Bulk assign */}
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
              <Users className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium whitespace-nowrap">Assign all to:</span>
              <Select value={bulkAssignee} onValueChange={handleBulkAssign}>
                <SelectTrigger className="flex-1 h-9">
                  <SelectValue placeholder="Select a person..." />
                </SelectTrigger>
                <SelectContent>
                  {candidates.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      <div className="flex items-center justify-between gap-3 w-full">
                        <span>{c.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {c.activeTaskCount} active task{c.activeTaskCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* No candidates warning */}
            {candidates.length === 0 && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                <span className="text-sm text-red-700">
                  No active {userInfo?.role}s available for reassignment. Please activate or create one first.
                </span>
              </div>
            )}

            {/* Task list */}
            <div className="overflow-y-auto flex-1 min-h-0 max-h-[50vh] space-y-2 pr-1">
              {tasks.map((task, idx) => (
                <div
                  key={task.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                    assignments[task.id]
                      ? 'bg-green-50/50 border-green-200'
                      : 'bg-white border-gray-200'
                  }`}
                >
                  {/* Task index */}
                  <div className="flex items-center justify-center h-6 w-6 rounded-full bg-muted text-xs font-bold text-muted-foreground shrink-0">
                    {idx + 1}
                  </div>

                  {/* Task info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{task.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 h-4 ${STATUS_STYLES[task.status] || ''}`}
                      >
                        {task.status.replace(/_/g, ' ')}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">{task.clientName}</span>
                      <span className="text-[10px] text-muted-foreground">• {task.deliverableType}</span>
                      {task.dueDate && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <Calendar className="h-2.5 w-2.5" />
                          {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Arrow */}
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />

                  {/* Assignee selector */}
                  <Select
                    value={assignments[task.id] || ''}
                    onValueChange={(v) => handleTaskAssign(task.id, v)}
                  >
                    <SelectTrigger className="w-[180px] h-9 shrink-0">
                      <SelectValue placeholder="Assign to..." />
                    </SelectTrigger>
                    <SelectContent>
                      {candidates.map(c => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          <div className="flex items-center gap-2">
                            <User className="h-3 w-3" />
                            <span>{c.name}</span>
                            <span className="text-[10px] text-muted-foreground">({c.activeTaskCount})</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Check indicator */}
                  {assignments[task.id] && (
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  )}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-3 border-t">
              <div className="text-sm text-muted-foreground">
                {assignedCount}/{tasks.length} task{tasks.length !== 1 ? 's' : ''} assigned
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleSubmit}
                  disabled={!allAssigned || submitting || candidates.length === 0}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Deactivating...
                    </>
                  ) : (
                    <>
                      Reassign & Deactivate
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}