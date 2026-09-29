"use client";

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  Send,
  Target,
  TrendingDown,
} from 'lucide-react';
import { Button } from '../../ui/button';
import { Card, CardContent } from '../../ui/card';
import { PageHeader } from '../../ui/page-header';
import { cn } from '@/lib/utils';
import { useDailyTargetsProgress } from './useDailyTargetsProgress';
import { ClientProgressDrawer } from './ClientProgressDrawer';
import { DeliverableSummaryLine } from './DeliverableRow';
import { STATUS_STYLE, formatDateEST } from './constants';
import type { ClientProgress, DailyTargetsRole } from './types';

interface DailyTargetsBoardProps {
  role: DailyTargetsRole;
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  color,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <Card className="border shadow-sm">
      <CardContent className="p-4">
        {/* Text sits in the middle of the card; the icon is pinned to the right
            and equal side padding keeps the text from running under it. */}
        <div className="relative flex items-center justify-center">
          <div className="space-y-1 text-center px-12">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
          </div>
          <div className={cn('absolute right-0 top-1/2 -translate-y-1/2 p-2.5 rounded-xl', color)}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Pulsing "Live" dot + "updated Ns ago". Turns amber if the last poll failed. */
function LiveIndicator({ lastUpdated, error, fetching }: { lastUpdated: number | null; error: boolean; fetching: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const secs = lastUpdated ? Math.max(0, Math.round((now - lastUpdated) / 1000)) : null;
  const label = error ? 'Reconnecting…' : secs === null ? 'Connecting…' : secs < 5 ? 'Live' : `Updated ${secs}s ago`;

  return (
    <div
      className="flex items-center gap-2 text-xs text-muted-foreground"
      title="Refreshes automatically every 15 seconds while this tab is open"
    >
      <span className="relative flex h-2 w-2">
        {!error && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />}
        <span className={cn('relative inline-flex h-2 w-2 rounded-full', error ? 'bg-amber-500' : 'bg-emerald-500')} />
      </span>
      <span className={cn(fetching && 'opacity-60')}>{label}</span>
    </div>
  );
}

function clientBorder(c: ClientProgress): string {
  if (c.noInventoryCount > 0 || c.status === 'critical') return 'border-red-200 dark:border-red-500/30';
  if (c.status === 'behind') return 'border-amber-200 dark:border-amber-500/30';
  return '';
}

export function DailyTargetsBoard({ role }: DailyTargetsBoardProps) {
  const { data, loading, isFetching, lastUpdated, error, selectedDate, navigateDate, goToToday, refetch } =
    useDailyTargetsProgress();

  const [drawerClientId, setDrawerClientId] = useState<string | null>(null);

  const summary = useMemo(() => {
    const clients = data?.clients ?? [];
    return {
      behind: clients.filter((c) => c.status === 'behind' || c.status === 'critical').length,
      onPace: clients.filter((c) => c.status !== 'behind' && c.status !== 'critical').length,
    };
  }, [data]);

  return (
    <div className="flex flex-col h-full space-y-6" data-role={role}>
      <PageHeader
        title="Posting Tracker"
        description="What each client owes today and month-to-date, from their monthly deliverables (EST)"
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <LiveIndicator lastUpdated={lastUpdated} error={error} fetching={isFetching} />

            <div className="flex items-center gap-1 border rounded-lg px-1 py-1 bg-card">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateDate(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="text-xs font-medium" onClick={goToToday}>
                <Calendar className="h-3.5 w-3.5 mr-1.5" />
                {data ? formatDateEST(data.date) : 'Today'}
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateDate(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <Button variant="outline" size="sm" onClick={refetch} disabled={isFetching}>
              <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', isFetching && 'animate-spin')} />
              Refresh
            </Button>
          </div>
        }
      />

      {loading && !data && (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        </div>
      )}

      {data && data.clients.length > 0 && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Posts Today"
              value={`${data.grandCompleted}/${data.grandTotal}`}
              subtitle={`${data.grandProgress}% of today's posts`}
              icon={<Send className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
              color="bg-indigo-50 dark:bg-indigo-500/15"
            />
            <StatCard
              title="No Completed Task"
              value={data.noInventoryCount}
              subtitle="due today, nothing ready to post"
              icon={<AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />}
              color="bg-red-50 dark:bg-red-500/15"
            />
            <StatCard
              title="Behind Pace"
              value={summary.behind}
              subtitle="clients behind this month"
              icon={<TrendingDown className="h-5 w-5 text-amber-600 dark:text-amber-400" />}
              color="bg-amber-50 dark:bg-amber-500/15"
            />
            <StatCard
              title="On Pace"
              value={summary.onPace}
              subtitle={`of ${data.clients.length} clients`}
              icon={<CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
              color="bg-emerald-50 dark:bg-emerald-500/15"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
            {data.clients.map((client) => {
              const style = STATUS_STYLE[client.status];
              const health = client.noInventoryCount > 0 ? 'No task ready' : style.label;
              const healthBadge = client.noInventoryCount > 0 ? STATUS_STYLE.critical.badge : style.badge;

              return (
                <Card
                  key={client.clientId}
                  className={cn('transition-all hover:shadow-md cursor-pointer gap-0', clientBorder(client))}
                >
                  <button onClick={() => setDrawerClientId(client.clientId)} className="w-full text-left p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-sm truncate">{client.clientName}</h3>
                        <p className="text-[11px] text-muted-foreground">
                          {client.totalRequired > 0
                            ? `${client.totalCompleted}/${client.totalRequired} posts today`
                            : 'nothing due today'}
                        </p>
                      </div>
                      <span className={cn('shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full', healthBadge)}>
                        {health}
                      </span>
                    </div>

                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, client.progress)}%`,
                          backgroundColor: client.noInventoryCount > 0 ? STATUS_STYLE.critical.bar : style.bar,
                        }}
                      />
                    </div>

                    <div className="space-y-1.5 pt-1">
                      {client.deliverables.map((d) => (
                        <DeliverableSummaryLine key={d.deliverableId} d={d} />
                      ))}
                    </div>
                  </button>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {data && data.clients.length === 0 && !loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center p-8">
            <Target className="h-16 w-16 mx-auto mb-4 text-muted-foreground/40" />
            <h3 className="text-lg font-semibold mb-2">Nothing to Track</h3>
            <p className="text-muted-foreground">
              No active clients have monthly deliverables with trackable platforms.
            </p>
          </div>
        </div>
      )}

      <ClientProgressDrawer
        clientId={drawerClientId}
        initialDate={selectedDate}
        open={!!drawerClientId}
        onOpenChange={(open) => {
          if (!open) setDrawerClientId(null);
        }}
      />
    </div>
  );
}
