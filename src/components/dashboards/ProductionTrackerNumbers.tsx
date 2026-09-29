'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Loader2, RefreshCw, ChevronDown, ChevronRight, CheckCircle2, AlertTriangle, Radio } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types (mirrors /api/admin/production-tracker-numbers — unchanged) ───

interface EditorTaskLoad {
  editorId: number;
  editorName: string;
  taskCount: number;
}

interface EditorIncomplete {
  editorId: number;
  editorName: string;
  total: number;
  done: number;
  remaining: number;
}

interface EditorRejectionRank {
  editorId: number;
  editorName: string;
  rejectCount: number;
}

interface EditorTopRejectionReason {
  editorId: number;
  editorName: string;
  topReason: string;
  topReasonCount: number;
  allReasons: { reason: string; count: number }[];
}

interface ClientDeliverable {
  deliverableId: string;
  type: string;
  promised: number;
  done: number;
  remaining: number;
}

interface ClientRemaining {
  clientId: string;
  clientName: string;
  deliverables: ClientDeliverable[];
}

interface StatusCount {
  status: string;
  count: number;
}

interface PostingRow {
  taskId: string;
  title: string;
  clientName: string;
  deliverableType: string;
}

interface NumbersData {
  month: string;
  totalTasks: number;
  editorTaskLoad: EditorTaskLoad[];
  editorIncomplete: EditorIncomplete[];
  editorRejectionRank: EditorRejectionRank[];
  editorTopRejectionReasons: EditorTopRejectionReason[];
  clientRemainingDeliverables: ClientRemaining[];
  statusCounts: StatusCount[];
  needsToBePosted: PostingRow[];
  alreadyPosted: PostingRow[];
}

// Same status→color language as TaskManagementTab's badges, so a color
// here means the same thing it means everywhere else in the app.
const STATUS_META: Record<string, { label: string; bar: string }> = {
  PENDING: { label: 'Pending', bar: 'bg-yellow-400' },
  VIDEOGRAPHER_ASSIGNED: { label: 'Videographer Assigned', bar: 'bg-blue-400' },
  IN_PROGRESS: { label: 'In Progress', bar: 'bg-purple-400' },
  READY_FOR_QC: { label: 'Ready For QC', bar: 'bg-orange-400' },
  QC_IN_PROGRESS: { label: 'QC In Progress', bar: 'bg-purple-500' },
  REJECTED_BY_QC: { label: 'Rejected By QC', bar: 'bg-red-500' },
  CLIENT_REVIEW: { label: 'Client Review', bar: 'bg-amber-400' },
  REJECTED_BY_CLIENT: { label: 'Rejected By Client', bar: 'bg-rose-500' },
  ON_HOLD: { label: 'On Hold', bar: 'bg-slate-400' },
  COMPLETED: { label: 'Completed', bar: 'bg-emerald-500' },
  SCHEDULED: { label: 'Scheduled', bar: 'bg-sky-500' },
  POSTED: { label: 'Posted', bar: 'bg-emerald-600' },
  HIDDEN: { label: 'Hidden', bar: 'bg-slate-300' },
};

const REFRESH_INTERVAL_MS = 20_000;

function fmtAgo(seconds: number): string {
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const m = Math.floor(seconds / 60);
  return `${m}m ago`;
}

// ─── Small building blocks ───

function LiveIndicator({ lastUpdated, onRefresh, refreshing }: { lastUpdated: Date | null; onRefresh: () => void; refreshing: boolean }) {
  const [, forceTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const secondsAgo = lastUpdated ? Math.floor((Date.now() - lastUpdated.getTime()) / 1000) : null;

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        <span className="font-medium text-emerald-700">Live</span>
        {secondsAgo !== null && <span>· updated {fmtAgo(secondsAgo)}</span>}
      </div>
      <button
        onClick={onRefresh}
        disabled={refreshing}
        className="p-1.5 rounded-md hover:bg-gray-100 text-muted-foreground disabled:opacity-50"
        title="Refresh now"
      >
        <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
      </button>
    </div>
  );
}

function HeroStat({
  label,
  value,
  sublabel,
  color = 'text-gray-900',
  icon,
}: {
  label: string;
  value: string;
  sublabel?: string;
  color?: string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="border shadow-sm">
      <CardContent className="p-4">
        {/* Text centered in the card; icon pinned right with equal side padding. */}
        <div className="relative flex items-center justify-center">
          <div className="space-y-1 text-center px-12">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className={cn('text-3xl font-bold tracking-tight', color)}>{value}</p>
            {sublabel && <p className="text-[11px] text-muted-foreground">{sublabel}</p>}
          </div>
          <div className="absolute right-0 top-1/2 -translate-y-1/2 p-2.5 rounded-xl bg-gray-50">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

/** One ranked row: label on the left, a single colored fill proportional to `value/max`, value directly labeled at the end — no axis, no legend needed for a single measure. */
function RankedBar({
  label,
  value,
  max,
  barClassName = 'bg-blue-500',
  formatValue = (v: number) => String(v),
  sublabel,
}: {
  label: string;
  value: number;
  max: number;
  barClassName?: string;
  formatValue?: (v: number) => string;
  sublabel?: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 py-1.5" title={`${label}: ${formatValue(value)}`}>
      <div className="w-36 shrink-0 min-w-0">
        <p className="text-xs font-medium text-gray-800 truncate">{label}</p>
        {sublabel && <p className="text-[10px] text-muted-foreground truncate">{sublabel}</p>}
      </div>
      <div className="flex-1 h-2.5 rounded-full bg-gray-100 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', barClassName)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-10 shrink-0 text-right text-sm font-bold tabular-nums">{formatValue(value)}</span>
    </div>
  );
}

/** Done + Remaining stacked to Total in one track, a 2px surface gap between segments — reads "how much is left" without subtracting done from total in your head. */
function StackedProgressRow({
  label,
  done,
  remaining,
  total,
}: {
  label: string;
  done: number;
  remaining: number;
  total: number;
}) {
  const donePct = total > 0 ? (done / total) * 100 : 0;
  const remainingPct = total > 0 ? (remaining / total) * 100 : 0;
  return (
    <div className="py-1.5" title={`${label}: ${done} done, ${remaining} remaining of ${total}`}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-medium text-gray-800 truncate">{label}</p>
        <p className="text-[11px] text-muted-foreground shrink-0">
          <span className="font-semibold text-emerald-700">{done}</span> done ·{' '}
          <span className={cn('font-semibold', remaining > 0 ? 'text-amber-700' : 'text-muted-foreground')}>{remaining}</span> left ·{' '}
          {total} total
        </p>
      </div>
      <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden flex gap-[2px]">
        {donePct > 0 && (
          <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${donePct}%` }} />
        )}
        {remainingPct > 0 && (
          <div className="h-full rounded-full bg-amber-400 transition-all duration-500" style={{ width: `${remainingPct}%` }} />
        )}
      </div>
    </div>
  );
}

export function ProductionTrackerNumbers({ month }: { month?: string }) {
  const [data, setData] = useState<NumbersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [expandedEditor, setExpandedEditor] = useState<number | null>(null);
  const inFlight = useRef(false);

  const fetchData = (opts: { silent?: boolean } = {}) => {
    if (inFlight.current) return;
    inFlight.current = true;
    if (!opts.silent) setLoading(true);
    else setRefreshing(true);

    const url = month
      ? `/api/admin/production-tracker-numbers?month=${encodeURIComponent(month)}`
      : '/api/admin/production-tracker-numbers';
    fetch(url, { cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch');
        return res.json();
      })
      .then((json) => {
        setData(json);
        setLastUpdated(new Date());
      })
      .catch((err) => console.error('Production tracker numbers fetch error:', err))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
        inFlight.current = false;
      });
  };

  // Initial + on month change: full loading state.
  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  // Live polling — silent (no loading flash), paused while the tab isn't
  // visible, and catches up immediately when it becomes visible again.
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') fetchData({ silent: true });
    };
    const interval = setInterval(tick, REFRESH_INTERVAL_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') fetchData({ silent: true });
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading numbers...</p>
      </div>
    );
  }

  if (!data) return null;

  // ─── Derived headline metrics (display-only — the API keeps returning hard counts) ───
  const doneStatuses = new Set(['COMPLETED', 'SCHEDULED', 'POSTED']);
  const doneCount = data.statusCounts.filter((s) => doneStatuses.has(s.status)).reduce((sum, s) => sum + s.count, 0);
  const completionPct = data.totalTasks > 0 ? Math.round((doneCount / data.totalTasks) * 100) : 0;
  const totalRejections = data.editorRejectionRank.reduce((sum, e) => sum + e.rejectCount, 0);
  const postingTotal = data.needsToBePosted.length + data.alreadyPosted.length;
  const postingPct = postingTotal > 0 ? Math.round((data.alreadyPosted.length / postingTotal) * 100) : 0;
  const totalRemainingDeliverables = data.clientRemainingDeliverables.reduce(
    (sum, c) => sum + c.deliverables.reduce((s, d) => s + d.remaining, 0),
    0
  );

  const rejectionMax = Math.max(1, ...data.editorRejectionRank.map((e) => e.rejectCount));
  const statusMax = Math.max(1, ...data.statusCounts.map((s) => s.count));
  const reasonMax = Math.max(1, ...data.editorTopRejectionReasons.map((e) => e.topReasonCount));

  // editorIncomplete already carries everything editorTaskLoad did (total
  // task count) plus done/remaining, for the same editors — one merged
  // view instead of two tables the reader had to cross-reference by hand.
  const editorWorkload = data.editorIncomplete;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{data.month}</p>
        <LiveIndicator lastUpdated={lastUpdated} onRefresh={() => fetchData({ silent: true })} refreshing={refreshing} />
      </div>

      {/* ─── Headline numbers — the answer, before any digging ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <HeroStat
          label="Total Tasks"
          value={String(data.totalTasks)}
          sublabel={`${doneCount} finished`}
          icon={<Radio className="h-5 w-5 text-gray-500" />}
        />
        <HeroStat
          label="Completion"
          value={`${completionPct}%`}
          sublabel="completed, scheduled or posted"
          color={completionPct >= 75 ? 'text-emerald-600' : completionPct >= 40 ? 'text-amber-600' : 'text-red-600'}
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />}
        />
        <HeroStat
          label="Rejections"
          value={String(totalRejections)}
          sublabel="QC + client sendbacks this month"
          color={totalRejections > 0 ? 'text-red-600' : 'text-gray-900'}
          icon={<AlertTriangle className="h-5 w-5 text-red-500" />}
        />
        <HeroStat
          label="Posting Progress"
          value={`${postingPct}%`}
          sublabel={`${data.alreadyPosted.length} of ${postingTotal} posted`}
          color={postingPct >= 75 ? 'text-emerald-600' : postingPct >= 40 ? 'text-amber-600' : 'text-red-600'}
          icon={<Radio className="h-5 w-5 text-sky-500" />}
        />
      </div>

      {/* ─── Task Status Pipeline ─── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold">Task Status Pipeline</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">Where every task sits right now, in pipeline order.</p>
        </CardHeader>
        <CardContent className="pt-0">
          {data.statusCounts.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No tasks this month.</p>
          ) : (
            <div className="space-y-0.5">
              {data.statusCounts.map((s) => (
                <RankedBar
                  key={s.status}
                  label={STATUS_META[s.status]?.label || s.status}
                  value={s.count}
                  max={statusMax}
                  barClassName={STATUS_META[s.status]?.bar || 'bg-gray-400'}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ─── Editor Workload (merged load + incomplete) ─── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold">Editor Workload</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Done vs. remaining, sorted by who has the most left.</p>
          </CardHeader>
          <CardContent className="pt-0">
            {editorWorkload.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No editors with tasks this month.</p>
            ) : (
              <div className="space-y-1.5">
                {editorWorkload.map((e) => (
                  <StackedProgressRow key={e.editorId} label={e.editorName} done={e.done} remaining={e.remaining} total={e.total} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ─── Editor Rejections ─── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold">Editor Rejections</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Every send-back this month — a task rejected twice counts twice, even if it's since been fixed.
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            {data.editorRejectionRank.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No rejections this month. 🎉</p>
            ) : (
              <div className="space-y-0.5">
                {data.editorRejectionRank.map((e) => (
                  <RankedBar key={e.editorId} label={e.editorName} value={e.rejectCount} max={rejectionMax} barClassName="bg-red-500" />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ─── Top Rejection Reason Per Editor ─── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold">Top Rejection Reason Per Editor</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">Click a row to see every reason logged against that editor.</p>
        </CardHeader>
        <CardContent className="pt-0">
          {data.editorTopRejectionReasons.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No rejection feedback logged this month.</p>
          ) : (
            <div className="space-y-1">
              {data.editorTopRejectionReasons.map((e) => {
                const isExpanded = expandedEditor === e.editorId;
                return (
                  <Fragment key={e.editorId}>
                    <button
                      onClick={() => setExpandedEditor(isExpanded ? null : e.editorId)}
                      className="w-full flex items-center gap-3 py-1.5 rounded-md hover:bg-gray-50 text-left"
                    >
                      {e.allReasons.length > 1 ? (
                        isExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                        )
                      ) : (
                        <span className="w-3.5 shrink-0" />
                      )}
                      <div className="w-32 shrink-0">
                        <p className="text-xs font-medium text-gray-800 truncate">{e.editorName}</p>
                      </div>
                      <div className="flex-1 h-2.5 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-orange-400 transition-all duration-500"
                          style={{ width: `${Math.min(100, (e.topReasonCount / reasonMax) * 100)}%` }}
                        />
                      </div>
                      <span className="w-8 shrink-0 text-right text-sm font-bold tabular-nums">{e.topReasonCount}</span>
                      <span className="w-48 shrink-0 text-xs text-muted-foreground truncate">{e.topReason}</span>
                    </button>
                    {isExpanded && e.allReasons.length > 1 && (
                      <div className="ml-9 mr-2 mb-2 rounded-lg bg-gray-50/80 p-3 space-y-1.5">
                        {e.allReasons.map((r) => (
                          <div key={r.reason} className="flex items-center gap-2 text-xs">
                            <span className="flex-1 text-gray-600 truncate">{r.reason}</span>
                            <span className="font-semibold text-gray-800">{r.count}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Fragment>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Client Remaining Deliverables — small multiples ─── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold">
            Client Remaining Deliverables {totalRemainingDeliverables > 0 && `(${totalRemainingDeliverables} left)`}
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">Promised this month, done so far, and what's left — per client.</p>
        </CardHeader>
        <CardContent className="pt-0">
          {data.clientRemainingDeliverables.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No clients with remaining deliverables.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {data.clientRemainingDeliverables.map((c) => (
                <div key={c.clientId} className="rounded-xl border p-3.5">
                  <p className="text-sm font-semibold mb-2">{c.clientName}</p>
                  <div className="space-y-2">
                    {c.deliverables
                      .filter((d) => d.remaining > 0)
                      .map((d) => (
                        <StackedProgressRow
                          key={d.deliverableId}
                          label={d.type}
                          done={d.done}
                          remaining={d.remaining}
                          total={d.promised}
                        />
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Posting Progress ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              Needs to Be Posted <Badge variant="secondary">{data.needsToBePosted.length}</Badge>
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Completed this month but not yet scheduled or posted.</p>
          </CardHeader>
          <CardContent className="pt-0">
            {data.needsToBePosted.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Nothing waiting to be posted. 🎉</p>
            ) : (
              <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                {data.needsToBePosted.map((row) => (
                  <div key={row.taskId} className="flex items-center gap-2 py-1.5 border-b last:border-0 text-sm">
                    <span className="flex-1 min-w-0 truncate font-medium">{row.title}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{row.clientName}</span>
                    <Badge variant="outline" className="text-[10px] shrink-0">{row.deliverableType}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              Already Posted <Badge variant="secondary">{data.alreadyPosted.length}</Badge>
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Posted this month.</p>
          </CardHeader>
          <CardContent className="pt-0">
            {data.alreadyPosted.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Nothing posted yet this month.</p>
            ) : (
              <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                {data.alreadyPosted.map((row) => (
                  <div key={row.taskId} className="flex items-center gap-2 py-1.5 border-b last:border-0 text-sm">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    <span className="flex-1 min-w-0 truncate font-medium">{row.title}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{row.clientName}</span>
                    <Badge variant="outline" className="text-[10px] shrink-0">{row.deliverableType}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
