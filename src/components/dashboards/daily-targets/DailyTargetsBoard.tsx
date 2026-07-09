"use client";

import { useState } from 'react';
import { Target, Calendar, ChevronLeft, ChevronRight, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '../../ui/button';
import { cn } from '@/lib/utils';
import { useDailyTargetsProgress } from './useDailyTargetsProgress';
import { ClientProgressDrawer } from './ClientProgressDrawer';
import { formatDateEST, getProgressColor, getProgressHexColor, getProgressIcon } from './constants';
import type { DailyTargetsRole } from './types';

interface DailyTargetsBoardProps {
  role: DailyTargetsRole;
}

const RING_RADIUS = 20;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function ProgressRing({ progress }: { progress: number }) {
  const pct = Math.min(progress, 100);
  const offset = RING_CIRCUMFERENCE - (pct / 100) * RING_CIRCUMFERENCE;
  const color = getProgressHexColor(progress);

  return (
    <svg width="48" height="48" viewBox="0 0 48 48" className="shrink-0 -rotate-90">
      <circle cx="24" cy="24" r={RING_RADIUS} fill="none" stroke="currentColor" strokeWidth="4" className="text-gray-100" />
      <circle
        cx="24" cy="24" r={RING_RADIUS} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round"
        strokeDasharray={RING_CIRCUMFERENCE} strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 500ms ease' }}
      />
    </svg>
  );
}

export function DailyTargetsBoard({ role }: DailyTargetsBoardProps) {
  const {
    data,
    loading,
    isFetching,
    selectedDate,
    navigateDate,
    goToToday,
    refetch,
  } = useDailyTargetsProgress();

  const [drawerClientId, setDrawerClientId] = useState<string | null>(null);

  return (
    <div className="flex flex-col h-full space-y-6" data-role={role}>
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-gray-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg">
              <Target className="h-6 w-6 text-white" />
            </div>
            Daily Posting Tracker
          </h1>
          <p className="text-muted-foreground mt-2 text-sm sm:text-base">
            Track scheduler posting compliance per platform per client (EST)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {data && (
            <div className={cn(
              "px-4 py-2 rounded-xl text-white font-bold text-lg",
              `bg-gradient-to-r ${getProgressColor(data.grandProgress)}`
            )}>
              {data.grandCompleted}/{data.grandTotal} today
            </div>
          )}

          <div className="flex items-center gap-1 border rounded-lg px-1 py-1">
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
            <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", isFetching && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {loading && !data && (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        </div>
      )}

      {data?.isSunday && (
        <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
          <Calendar className="h-4 w-4 text-amber-600" />
          <span className="text-sm font-medium text-amber-800">
            Sunday — weekly LF targets are active today
          </span>
        </div>
      )}

      {data && data.clients.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {data.clients.map((client) => {
            const isDone = client.progress >= 100;

            return (
              <button
                key={client.clientId}
                onClick={() => setDrawerClientId(client.clientId)}
                className={cn(
                  "text-left bg-white rounded-2xl border shadow-sm p-5 flex items-center gap-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200",
                  isDone && "opacity-75"
                )}
              >
                <div className="relative flex items-center justify-center">
                  <ProgressRing progress={client.progress} />
                  <span className="absolute text-xs font-bold text-gray-700">{client.progress}%</span>
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900 text-base truncate">{client.clientName}</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {getProgressIcon(client.progress)}
                    <p className="text-sm text-muted-foreground">
                      {client.totalCompleted}/{client.totalRequired} done today
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {data && data.clients.length === 0 && !loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center p-8">
            <Target className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Posting Targets</h3>
            <p className="text-muted-foreground">
              No daily posting targets configured. Run the seed script to populate targets.
            </p>
          </div>
        </div>
      )}

      <ClientProgressDrawer
        clientId={drawerClientId}
        initialDate={selectedDate}
        open={!!drawerClientId}
        onOpenChange={(open) => { if (!open) setDrawerClientId(null); }}
      />
    </div>
  );
}
