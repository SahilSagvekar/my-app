'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '../ui/card';
import { PageHeader } from '../ui/page-header';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Loader2, ExternalLink, Send, RefreshCw, Inbox, Image as ImageIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { getDeliverableBadge, isLongFormTask } from '@/lib/deliverable-badge';
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
  deliverableType?: string | null;
  taskCategory?: string | null;
  editorName?: string | null;
  thumbnails?: string[];
  latestVersion?: number;
  fileCount?: number;
}

const AUTO_REMINDER_THRESHOLD_DAYS = 5;

function daysAgo(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24)));
}

export function ClientReviewPanel({ scope }: { scope: 'scheduler' | 'qc' }) {
  const [tasks, setTasks] = useState<TaskInReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [thumbIndex, setThumbIndex] = useState<Record<string, number>>({});

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
            {/* <Clock className="h-7 w-7" /> */}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {tasks.map((task) => {
            const overdue = task.daysInReview >= AUTO_REMINDER_THRESHOLD_DAYS;
            const thumbs = task.thumbnails || [];
            const idx = (thumbIndex[task.id] || 0) < thumbs.length ? thumbIndex[task.id] || 0 : 0;
            const isLongForm = isLongFormTask(task.deliverableType, task.taskCategory, task.title);
            const badge = getDeliverableBadge(task.deliverableType, task.title);
            const dueLabel = task.dueDate
              ? new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              : '';
            const setIdx = (i: number) => setThumbIndex((prev) => ({ ...prev, [task.id]: i }));

            return (
              <div
                key={task.id}
                className={cn(
                  'group rounded-2xl overflow-hidden flex flex-col h-full bg-[#0e0f12] border shadow-md hover:shadow-xl transition-all duration-200',
                  overdue ? 'border-red-500/50 hover:border-red-400/70' : 'border-zinc-800/90 hover:border-zinc-700',
                  isLongForm ? 'col-span-1 sm:col-span-2' : 'col-span-1'
                )}
              >
                {/* Thumbnail */}
                <div
                  className={cn(
                    'w-full relative flex items-center justify-center bg-[#14151a] overflow-hidden select-none',
                    isLongForm ? 'aspect-video' : 'aspect-[4/5]'
                  )}
                >
                  {thumbs.length > 0 ? (
                    <>
                      <img
                        key={thumbs[idx]}
                        src={thumbs[idx]}
                        alt={task.title || 'Task thumbnail'}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 z-10"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.opacity = '0';
                        }}
                      />
                      <div className="absolute inset-0 bg-black/10 z-10 pointer-events-none" />

                      {thumbs.length > 1 && (
                        <>
                          <button
                            type="button"
                            className="absolute left-2.5 top-1/2 -translate-y-1/2 z-20 h-8 w-8 rounded-full bg-black/60 hover:bg-black/85 text-white flex items-center justify-center backdrop-blur-md shadow-md border border-white/10 transition-all hover:scale-110 active:scale-95 focus:outline-none"
                            onClick={() => setIdx(idx > 0 ? idx - 1 : thumbs.length - 1)}
                            aria-label="Previous thumbnail"
                          >
                            <ChevronLeft className="h-4 w-4 stroke-[2.5]" />
                          </button>
                          <button
                            type="button"
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 z-20 h-8 w-8 rounded-full bg-black/60 hover:bg-black/85 text-white flex items-center justify-center backdrop-blur-md shadow-md border border-white/10 transition-all hover:scale-110 active:scale-95 focus:outline-none"
                            onClick={() => setIdx(idx < thumbs.length - 1 ? idx + 1 : 0)}
                            aria-label="Next thumbnail"
                          >
                            <ChevronRight className="h-4 w-4 stroke-[2.5]" />
                          </button>
                          <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10">
                            {thumbs.map((_, i) => (
                              <button
                                key={i}
                                type="button"
                                className={cn(
                                  'rounded-full transition-all duration-200 focus:outline-none',
                                  i === idx ? 'w-3.5 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/45 hover:bg-white/80'
                                )}
                                onClick={() => setIdx(i)}
                                aria-label={`Go to thumbnail ${i + 1}`}
                              />
                            ))}
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-[#14151a] z-10">
                      <ImageIcon className="h-7 w-7 text-zinc-600 stroke-[1.5] mb-1.5" />
                      <span className="text-xs font-medium text-zinc-500">No thumbnail</span>
                    </div>
                  )}

                  {/* Days in review */}
                  <span
                    className={cn(
                      'absolute top-3 right-3 z-20 inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold backdrop-blur-md shadow-sm',
                      overdue ? 'bg-red-600 text-white' : 'bg-black/65 text-zinc-100 border border-white/15'
                    )}
                  >
                    {task.daysInReview} day{task.daysInReview === 1 ? '' : 's'}
                  </span>
                </div>

                {/* Body */}
                <div className="p-4 pt-3 pb-3.5 flex flex-col gap-2 bg-[#0e0f12] shrink-0 mt-auto">
                  <h4 className="text-[13px] font-bold text-white truncate leading-snug tracking-tight" title={task.title || undefined}>
                    {task.title || 'Untitled Task'}
                  </h4>

                  <div className="flex items-center justify-between text-xs text-zinc-400 leading-none gap-2">
                    <span className="truncate">{task.clientName}</span>
                    {dueLabel && <span className="shrink-0">{dueLabel}</span>}
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-800/70 mt-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {badge && (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] sm:text-[11px] font-bold tracking-wide uppercase shrink-0 ${badge.colorClass}`}>
                          {badge.label}
                        </span>
                      )}
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-semibold bg-[#27272a] text-zinc-300 shrink-0">
                        V{task.latestVersion || 1}
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5 text-zinc-400 shrink-0">
                      {task.editorName && (
                        <span className="text-[11px] truncate max-w-[90px]" title={task.editorName}>
                          {task.editorName}
                        </span>
                      )}
                      <div className="flex items-center gap-1 text-[11px] font-medium" title={`${task.fileCount || 0} file(s)`}>
                        <ImageIcon className="h-3.5 w-3.5 stroke-[1.75]" />
                        <span>{task.fileCount || 0}</span>
                      </div>
                    </div>
                  </div>

                  {task.lastReminderSentAt && (
                    <p className="text-[11px] text-zinc-500">
                      Last reminded {daysAgo(task.lastReminderSentAt)} day{daysAgo(task.lastReminderSentAt) === 1 ? '' : 's'} ago
                    </p>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs flex-1 bg-transparent border-zinc-700 text-zinc-200 hover:bg-zinc-800 hover:text-white"
                      asChild
                    >
                      <a href={task.reviewUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3 w-3 mr-1.5" />
                        Review Link
                      </a>
                    </Button>
                    <Button
                      size="sm"
                      className="h-8 text-xs flex-1 bg-white text-zinc-900 hover:bg-zinc-200"
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}