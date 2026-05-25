'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Target,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronRight,
  Video,
  Film,
  Square,
  Image as ImageIcon,
  Zap,
  Calendar,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface EditorDeliverableProgress {
  deliverableId: string;
  type: string;
  statusCounts: {
    total: number;
    pending: number;
    inProgress: number;
    readyForQc: number;
    completed: number;
    scheduled: number;
    posted: number;
    clientReview: number;
    onHold: number;
  };
  doneCount: number;
  totalEditorTasks: number;
  extraCount: number;
  extraDoneCount: number;
  progressPercent: number;
}

interface EditorClientProgress {
  clientId: string;
  clientName: string;
  deliverables: EditorDeliverableProgress[];
  totalTasks: number;
  totalEditorTasks: number;
  totalDone: number;
  totalExtraTasks: number;
  totalExtraDone: number;
  overallProgress: number;
}

interface EditorTrackerData {
  month: string;
  editor: { id: number; name: string; role: string };
  summary: {
    totalClients: number;
    totalTasks: number;
    totalEditorTasks: number;
    totalDone: number;
    overallProgress: number;
    pending: number;
    inProgress: number;
    readyForQc: number;
    completed: number;
  };
  clientProgress: EditorClientProgress[];
  availableMonths: string[];
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  'Short Form Videos': <Video className="h-3.5 w-3.5" />,
  'Long Form Videos': <Film className="h-3.5 w-3.5" />,
  'Square Form Videos': <Square className="h-3.5 w-3.5" />,
  'Thumbnails': <ImageIcon className="h-3.5 w-3.5" />,
  'Beta Short Form': <Zap className="h-3.5 w-3.5" />,
};

const SHORT_TYPE: Record<string, string> = {
  'Short Form Videos': 'SF',
  'Long Form Videos': 'LF',
  'Square Form Videos': 'SQF',
  'Thumbnails': 'THUMB',
  'Tiles': 'TILE',
  'Hard Posts / Graphic Images': 'HP',
  'Snapchat Episodes': 'SNAP',
  'Beta Short Form': 'BSF',
};

export function EditorProductionTracker() {
  const [data, setData] = useState<EditorTrackerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [expandedClients, setExpandedClients] = useState<Set<string>>(() => new Set());

  const fetchData = async (month?: string) => {
    try {
      setLoading(true);
      const url = month
        ? `/api/editor/production-tracker?month=${encodeURIComponent(month)}`
        : '/api/editor/production-tracker';
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      setData(json);
      if (!selectedMonth && json.month) setSelectedMonth(json.month);
    } catch (err) {
      console.error('Editor tracker fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const toggleClient = (id: string) => {
    setExpandedClients((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading your tracker...</p>
      </div>
    );
  }

  if (!data) return null;

  const { summary } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Target className="h-6 w-6 text-violet-600" />
            My Tracker
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your task progress across all clients · {data.month}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedMonth} onValueChange={(m) => { setSelectedMonth(m); fetchData(m); }}>
            <SelectTrigger className="w-[180px] h-9 text-sm">
              <Calendar className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Select month" />
            </SelectTrigger>
            <SelectContent>
              {data.availableMonths.map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => fetchData(selectedMonth)} disabled={loading} className="h-9">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Overall Progress', value: `${summary.overallProgress}%`, color: 'bg-violet-50 text-violet-700' },
          { label: 'Active Clients', value: summary.totalClients, color: 'bg-blue-50 text-blue-700' },
          { label: 'In Progress', value: summary.inProgress, color: 'bg-amber-50 text-amber-700' },
          { label: 'Completed', value: summary.completed, color: 'bg-emerald-50 text-emerald-700' },
        ].map((s) => (
          <Card key={s.label} className="border shadow-sm">
            <CardContent className="p-4">
              <div className={cn('inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold mb-2', s.color)}>
                {s.label}
              </div>
              <p className="text-2xl font-bold tracking-tight">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Overall progress bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground font-medium">Overall completion this month</span>
          <span className="font-bold">{summary.overallProgress}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-700',
              summary.overallProgress >= 75 ? 'bg-emerald-500' :
              summary.overallProgress >= 40 ? 'bg-amber-500' : 'bg-red-500'
            )}
            style={{ width: `${summary.overallProgress}%` }}
          />
        </div>
      </div>

      {/* Client list */}
      {data.clientProgress.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">No tasks assigned this month</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.clientProgress
            .sort((a, b) => a.overallProgress - b.overallProgress)
            .map((client) => {
              const isExpanded = expandedClients.has(client.clientId);
              return (
                <Card
                  key={client.clientId}
                  className={cn(
                    'transition-all',
                    client.overallProgress < 40 && 'border-red-200',
                    client.overallProgress >= 40 && client.overallProgress < 75 && 'border-amber-200'
                  )}
                >
                  <button
                    onClick={() => toggleClient(client.clientId)}
                    className="w-full flex items-center gap-4 p-4 text-left hover:bg-gray-50/50 transition-colors"
                  >
                    {isExpanded
                      ? <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
                      : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
                    }

                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm mb-1.5">{client.clientName}</p>
                      <div className="flex flex-wrap gap-1">
                        {client.deliverables.map((d) => (
                          <span
                            key={d.deliverableId}
                            className={cn(
                              'text-[9px] font-bold px-1.5 py-0.5 rounded',
                              d.progressPercent >= 75
                                ? 'bg-emerald-100 text-emerald-700'
                                : d.progressPercent >= 40
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-red-100 text-red-700'
                            )}
                          >
                            {SHORT_TYPE[d.type] || d.type.slice(0, 3)} {d.progressPercent}%
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 w-48 shrink-0">
                      <div className="flex-1">
                        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all duration-500',
                              client.overallProgress >= 75 ? 'bg-emerald-500' :
                              client.overallProgress >= 40 ? 'bg-amber-500' : 'bg-red-500'
                            )}
                            style={{ width: `${client.overallProgress}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-xs font-bold w-10 text-right">
                        {client.overallProgress}%
                      </span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 border-t bg-gray-50/50">
                      <div className="pt-4 space-y-3">
                        {client.deliverables.map((del) => (
                          <div key={del.deliverableId} className="bg-white rounded-lg border p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                {TYPE_ICONS[del.type] || <Video className="h-3.5 w-3.5" />}
                                <span className="text-sm font-medium">{del.type}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold">{del.progressPercent}%</span>
                                {del.extraCount > 0 && (
                                  <span className="text-[10px] font-bold text-rose-700">
                                    extra
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden mb-2">
                              <div
                                className={cn(
                                  'h-full rounded-full transition-all duration-500',
                                  del.progressPercent >= 75 ? 'bg-emerald-500' :
                                  del.progressPercent >= 40 ? 'bg-amber-500' : 'bg-red-500'
                                )}
                                style={{ width: `${del.progressPercent}%` }}
                              />
                            </div>

                            <div className="flex flex-wrap gap-1.5">
                              {del.statusCounts.pending > 0 && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                                  Pending
                                </span>
                              )}
                              {del.statusCounts.inProgress > 0 && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-600">
                                  Editing
                                </span>
                              )}
                              {del.statusCounts.readyForQc > 0 && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-600">
                                  In QC
                                </span>
                              )}
                              {del.statusCounts.clientReview > 0 && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-100 text-orange-600">
                                  Client Review
                                </span>
                              )}
                              {del.statusCounts.completed > 0 && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-600">
                                  Done
                                </span>
                              )}
                              {del.statusCounts.scheduled > 0 && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-100 text-sky-600">
                                  Scheduled
                                </span>
                              )}
                              {del.statusCounts.posted > 0 && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                                  Posted
                                </span>
                              )}
                              {del.statusCounts.onHold > 0 && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                                  On Hold
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
        </div>
      )}
    </div>
  );
}