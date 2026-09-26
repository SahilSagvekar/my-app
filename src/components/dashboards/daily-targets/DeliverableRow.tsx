"use client";

import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DeliverableProgress } from './types';
import { DELIVERABLE_COLORS, PLATFORM_LABEL, STATUS_STYLE, TYPE_NAME, formatPostingDays } from './constants';

function typeLabel(d: DeliverableProgress): string {
  return TYPE_NAME[d.type] ?? d.typeLabel;
}

/** Shown when something is due today but no COMPLETED, unposted task exists for it. */
export function NoInventoryWarning({ d }: { d: DeliverableProgress }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600">
      <AlertTriangle className="h-3.5 w-3.5" />
      No completed {d.type} task available
    </span>
  );
}

/** One-line summary used on the board cards. */
export function DeliverableSummaryLine({ d }: { d: DeliverableProgress }) {
  const color = DELIVERABLE_COLORS[d.type] || { bg: 'bg-gray-100', text: 'text-gray-700' };
  const style = STATUS_STYLE[d.status];
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
      <span className={cn('px-1.5 py-0.5 rounded text-[11px] font-bold', color.bg, color.text)}>{d.type}</span>
      {d.dueToday > 0 ? (
        <span className="text-gray-700">
          {d.todayPostsDone}/{d.todayPostsRequired} today
        </span>
      ) : (
        <span className="text-muted-foreground">{d.status === 'done' ? 'quota met' : 'not due today'}</span>
      )}
      <span className="text-muted-foreground">
        · {d.monthPosted}/{d.quantity} mo
      </span>
      {d.behindBy > 0 && (
        <span className={cn('px-1.5 rounded text-[11px] font-semibold', style.badge)}>behind {d.behindBy}</span>
      )}
      {d.noInventory && <NoInventoryWarning d={d} />}
    </div>
  );
}

function Flag({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-xs text-amber-700">
      <AlertTriangle className="h-3.5 w-3.5 mt-px shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/** Full block used in the client drawer. */
export function DeliverableBlock({ d }: { d: DeliverableProgress }) {
  const color = DELIVERABLE_COLORS[d.type] || { bg: 'bg-gray-100', text: 'text-gray-700' };
  const style = STATUS_STYLE[d.status];
  const pct = d.quantity > 0 ? Math.min(100, Math.round((d.monthPosted / d.quantity) * 100)) : 0;
  const expectedPct = d.quantity > 0 ? Math.min(100, Math.round((d.expectedByToday / d.quantity) * 100)) : 0;

  return (
    <div className="rounded-xl border bg-white p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className={cn('px-2 py-0.5 rounded text-xs font-bold', color.bg, color.text)}>{d.type}</span>
            <span className="font-semibold text-gray-900">{typeLabel(d)}</span>
            {d.isTrial && <span className="text-[10px] font-bold uppercase text-amber-600">Trial</span>}
          </div>
          <p className="text-xs text-muted-foreground">
            {formatPostingDays(d.postingDays)} · {d.videosPerDay}/day ·{' '}
            {d.platforms.map((p) => PLATFORM_LABEL[p] ?? p).join(' · ')}
          </p>
        </div>
        <span className={cn('px-2 py-0.5 rounded-md text-xs font-semibold', style.badge)}>
          {d.behindBy > 0 ? `${style.label} · ${d.behindBy}` : style.label}
        </span>
      </div>

      {/* Today */}
      <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm">
        {d.dueToday > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-gray-800">
              <span className="font-semibold">Today:</span> due {d.dueToday} → {d.todayPostsDone}/{d.todayPostsRequired} posts
            </span>
            {d.noInventory ? (
              <NoInventoryWarning d={d} />
            ) : d.todayPostsDone < d.todayPostsRequired ? (
              <span className="text-xs text-muted-foreground">{d.readyToPost} ready to post</span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                <CheckCircle2 className="h-3.5 w-3.5" /> done
              </span>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground">
            {d.status === 'done' ? 'Monthly quota met' : `Not a posting day (${formatPostingDays(d.postingDays)})`}
          </span>
        )}
      </div>

      {/* Month to date */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-gray-700">
            {d.monthPosted} of {d.quantity} this month
          </span>
          <span className="text-muted-foreground">
            expected by today: {d.expectedByToday}
            {d.behindBy > 0 && <span className="text-rose-600 font-semibold"> · behind {d.behindBy}</span>}
          </span>
        </div>
        <div className="relative h-2 rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: style.bar }} />
          <div
            className="absolute top-0 h-full w-0.5 bg-gray-500/70"
            style={{ left: `${expectedPct}%` }}
            title="Expected by today"
          />
        </div>
        <div className="flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
          {d.platforms.map((p) => (
            <span key={p}>
              {PLATFORM_LABEL[p] ?? p} {d.perPlatform[p] ?? 0}
            </span>
          ))}
        </div>
      </div>

      {/* Flags */}
      <div className="space-y-1">
        {d.cannotFinish && d.owed > 0 && (
          <Flag>
            {d.owed} still owed but only {d.slotsLeft} scheduled slot{d.slotsLeft === 1 ? '' : 's'} left — can&apos;t
            finish the quota
          </Flag>
        )}
        {d.scheduleMismatch && (
          <Flag>
            Quota is {d.quantity} but the schedule only fits {d.totalSlots} this month — fix the quota or the schedule
          </Flag>
        )}
        {d.nothingLogged && <Flag>Nothing logged this month for {d.type}</Flag>}
        {d.partialDetails.map((p) => (
          <Flag key={p.taskId}>
            Partly posted{p.title ? ` "${p.title}"` : ''} — missing{' '}
            {p.missing.map((m) => PLATFORM_LABEL[m] ?? m).join(', ')}
          </Flag>
        ))}
      </div>
    </div>
  );
}
