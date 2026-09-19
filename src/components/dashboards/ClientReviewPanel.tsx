'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '../ui/card';
import { PageHeader } from '../ui/page-header';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Loader2, Clock, ExternalLink, Send, RefreshCw, Inbox } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface TaskInReview {
  id: string;
  title: string | null;
  clientId: string | null;
  clientName: string;
  daysInReview: number;
  lastReminderSentAt: string | null;
  reviewUrl: string;
  dueDate: string | null;
}

const AUTO_REMINDER_THRESHOLD_DAYS = 5;

function daysAgo(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24)));
}

export function ClientReviewPanel({ scope }: { scope: 'scheduler' | 'qc' }) {
  const [tasks, setTasks] = useState<TaskInReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/tasks/in-review?scope=${scope}`, { credentials: 'include' });
      const data = await res.json();
      if (data.ok) setTasks(data.tasks || []);
    } catch {
      toast.error('Failed to load tasks in review');
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleSendReminder = async (task: TaskInReview) => {
    setSendingId(task.id);
    try {
      const res = await fetch(`/api/tasks/${task.id}/send-review-reminder`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message || 'Failed to send reminder');
      toast.success(`Reminder sent for "${task.title || 'Untitled Task'}"`);
      loadTasks();
    } catch (err: any) {
      toast.error(err.message || 'Failed to send reminder');
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <Clock className="h-7 w-7" />
            Client Review
            {tasks.length > 0 && (
              <Badge variant="secondary" className="text-sm font-normal">{tasks.length}</Badge>
            )}
          </span>
        }
        description="Videos currently awaiting client review, and reminders sent"
        actions={
          <Button variant="outline" onClick={loadTasks} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
            Refresh
          </Button>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : tasks.length === 0 ? (
        <Card>
          <CardContent className="text-center py-24 text-muted-foreground">
            <Inbox className="h-10 w-10 mx-auto mb-3 opacity-30" />
            Nothing waiting on client review right now.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {tasks.map((task) => {
            const overdue = task.daysInReview >= AUTO_REMINDER_THRESHOLD_DAYS;
            return (
              <div
                key={task.id}
                className={cn(
                  'rounded-lg border p-4 space-y-3 bg-white',
                  overdue ? 'border-red-200 bg-red-50/40' : 'border-gray-200'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{task.title || 'Untitled Task'}</p>
                    <p className="text-xs text-muted-foreground truncate">{task.clientName}</p>
                  </div>
                  <Badge
                    className={cn(
                      'text-[10px] font-bold shrink-0',
                      overdue
                        ? 'bg-red-100 text-red-700 border-red-200'
                        : 'bg-gray-100 text-gray-600 border-gray-200'
                    )}
                  >
                    {task.daysInReview} day{task.daysInReview === 1 ? '' : 's'}
                  </Badge>
                </div>

                {task.lastReminderSentAt && (
                  <p className="text-[11px] text-muted-foreground">
                    Last reminded {daysAgo(task.lastReminderSentAt)} day{daysAgo(task.lastReminderSentAt) === 1 ? '' : 's'} ago
                  </p>
                )}

                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="h-8 text-xs flex-1" asChild>
                    <a href={task.reviewUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3 mr-1.5" />
                      Review Link
                    </a>
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 text-xs flex-1"
                    disabled={sendingId === task.id}
                    onClick={() => handleSendReminder(task)}
                  >
                    {sendingId === task.id ? (
                      <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                    ) : (
                      <Send className="h-3 w-3 mr-1.5" />
                    )}
                    Send Reminder
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}