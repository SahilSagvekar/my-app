// FILE: src/components/dashboards/TimeClockTab.tsx
// The "Time Clock" tab inside Production Tracker (admin/manager/scheduler/videographer).
// Daily mode shows, per person, a merged timeline of clock-in/out + their task
// activity for a chosen EST calendar date. Weekly/Monthly modes show each
// person's total hours for that range with a per-day breakdown — click a day
// there to jump into its full Daily timeline.

'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Loader2, Clock, LogIn, LogOut, AlertTriangle, ChevronDown, ChevronRight, Activity, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

import { formatEasternTime } from '@/lib/est-date';

type Mode = 'day' | 'week' | 'month';

interface TimelineEvent {
  at: string;
  type: 'clock_in' | 'clock_out' | 'clock_out_auto' | 'task_event';
  label: string;
}

interface PersonDay {
  userId: number;
  name: string;
  role: string | null;
  clockInAt: string;
  clockOutAt: string | null;
  autoClosedOut: boolean;
  stillClockedIn: boolean;
  timeline: TimelineEvent[];
}

interface RangeDay {
  date: string;
  minutes: number;
  clockInAt: string;
  clockOutAt: string | null;
  autoClosedOut: boolean;
  stillClockedIn: boolean;
}

interface PersonRange {
  userId: number;
  name: string;
  role: string | null;
  totalMinutes: number;
  daysWorked: number;
  days: RangeDay[];
}

function todayEastern(): string {
  // Matches getESTDateString() on the server — South Carolina calendar date.
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function addMonths(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setMonth(dt.getMonth() + months);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function fmtHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function fmtDayLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function fmtWeekLabel(start: string, end: string): string {
  const s = new Date(`${start}T12:00:00`);
  const e = new Date(`${end}T12:00:00`);
  const sameMonth = s.getMonth() === e.getMonth();
  const startStr = s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endStr = e.toLocaleDateString(
    'en-US',
    sameMonth ? { day: 'numeric', year: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' }
  );
  return `${startStr} – ${endStr}`;
}

function fmtMonthLabel(start: string): string {
  const s = new Date(`${start}T12:00:00`);
  return s.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function eventIcon(type: TimelineEvent['type']) {
  switch (type) {
    case 'clock_in':
      return <LogIn className="h-3.5 w-3.5 text-emerald-600" />;
    case 'clock_out':
      return <LogOut className="h-3.5 w-3.5 text-red-600" />;
    case 'clock_out_auto':
      return <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />;
    default:
      return <Activity className="h-3.5 w-3.5 text-blue-600" />;
  }
}

function PersonCard({ person }: { person: PersonDay }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <Card>
      <CardHeader
        className="pb-3 cursor-pointer select-none"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-400" />
            )}
            <CardTitle className="text-sm font-bold">{person.name}</CardTitle>
            {person.role && (
              <Badge variant="outline" className="text-[10px] capitalize">
                {person.role.toLowerCase()}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs">
            {person.stillClockedIn ? (
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">
                Clocked in — {formatEasternTime(person.clockInAt)}
              </Badge>
            ) : (
              <span className="text-gray-500">
                {formatEasternTime(person.clockInAt)} – {person.clockOutAt ? formatEasternTime(person.clockOutAt) : '—'}
                {person.autoClosedOut && (
                  <span className="ml-1.5 text-amber-600 font-medium">(auto-closed)</span>
                )}
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="pt-0">
          <div className="space-y-2 border-l-2 border-gray-100 pl-4 ml-1.5">
            {person.timeline.map((event, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <div className="mt-0.5">{eventIcon(event.type)}</div>
                <div className="flex-1">
                  <span className="text-gray-700">{event.label}</span>
                  <span className="text-gray-400 ml-2">{formatEasternTime(event.at)}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function RangePersonCard({ person, onSelectDay }: { person: PersonRange; onSelectDay: (date: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const maxMinutes = Math.max(1, ...person.days.map((d) => d.minutes));

  return (
    <Card>
      <CardHeader
        className="pb-3 cursor-pointer select-none"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-400" />
            )}
            <CardTitle className="text-sm font-bold">{person.name}</CardTitle>
            {person.role && (
              <Badge variant="outline" className="text-[10px] capitalize">
                {person.role.toLowerCase()}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span>{person.daysWorked} day{person.daysWorked === 1 ? '' : 's'}</span>
            <span className="text-sm font-bold text-gray-900">{fmtHours(person.totalMinutes)}</span>
          </div>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="pt-0">
          <div className="space-y-1.5">
            {person.days.map((d) => (
              <button
                key={d.date}
                onClick={() => onSelectDay(d.date)}
                className="w-full flex items-center gap-2 text-xs group py-1 -mx-1 px-1 rounded-md hover:bg-gray-50"
              >
                <span className="w-24 shrink-0 text-left text-gray-500 group-hover:text-gray-800">
                  {fmtDayLabel(d.date)}
                </span>
                <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full', d.stillClockedIn ? 'bg-emerald-500' : 'bg-blue-500')}
                    style={{ width: `${Math.min(100, (d.minutes / maxMinutes) * 100)}%` }}
                  />
                </div>
                <span className="w-16 text-right font-semibold text-gray-700">{fmtHours(d.minutes)}</span>
                {d.autoClosedOut && <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />}
                <ChevronRight className="h-3 w-3 text-gray-300 shrink-0 group-hover:text-gray-500" />
              </button>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export function TimeClockTab() {
  const [mode, setMode] = useState<Mode>('day');
  const [date, setDate] = useState(todayEastern());

  const [people, setPeople] = useState<PersonDay[] | null>(null);
  const [rangePeople, setRangePeople] = useState<PersonRange[] | null>(null);
  const [rangeBounds, setRangeBounds] = useState<{ start: string; end: string } | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const url =
      mode === 'day'
        ? `/api/admin/production-tracker/time-clock?date=${date}`
        : `/api/admin/production-tracker/time-clock?mode=${mode}&date=${date}`;

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load');
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        if (mode === 'day') {
          setPeople(data.people || []);
        } else {
          setRangePeople(data.people || []);
          setRangeBounds({ start: data.rangeStart, end: data.rangeEnd });
        }
      })
      .catch(() => {
        if (!cancelled) setError(mode === 'day' ? 'Could not load time clock data.' : 'Could not load time clock summary.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [mode, date]);

  const rangeLabel = useMemo(() => {
    if (!rangeBounds) return '';
    return mode === 'week' ? fmtWeekLabel(rangeBounds.start, rangeBounds.end) : fmtMonthLabel(rangeBounds.start);
  }, [mode, rangeBounds]);

  const handlePrev = () => setDate((d) => (mode === 'week' ? addDays(d, -7) : mode === 'month' ? addMonths(d, -1) : addDays(d, -1)));
  const handleNext = () => setDate((d) => (mode === 'week' ? addDays(d, 7) : mode === 'month' ? addMonths(d, 1) : addDays(d, 1)));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg w-fit">
          {(['day', 'week', 'month'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-all',
                mode === m ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              )}
            >
              {m === 'day' ? 'Daily' : m === 'week' ? 'Weekly' : 'Monthly'}
            </button>
          ))}
        </div>

        {mode === 'day' ? (
          <div className="flex items-center gap-3">
            <Clock className="h-4 w-4 text-gray-400" />
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-auto"
            />
            <span className="text-xs text-gray-400 hidden sm:inline">Times shown in Eastern Time (South Carolina)</span>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <button onClick={handlePrev} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold w-48 text-center">{rangeLabel || '—'}</span>
            <button onClick={handleNext} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {error && <div className="text-sm text-red-600 py-8 text-center">{error}</div>}

      {!loading && !error && mode === 'day' && people && people.length === 0 && (
        <div className="text-sm text-gray-400 py-16 text-center">Nobody clocked in on this date.</div>
      )}

      {!loading && !error && mode === 'day' && people && people.length > 0 && (
        <div className="space-y-3">
          {people.map((p) => (
            <PersonCard key={p.userId} person={p} />
          ))}
        </div>
      )}

      {!loading && !error && mode !== 'day' && rangePeople && rangePeople.length === 0 && (
        <div className="text-sm text-gray-400 py-16 text-center">Nobody clocked in during this {mode}.</div>
      )}

      {!loading && !error && mode !== 'day' && rangePeople && rangePeople.length > 0 && (
        <div className="space-y-3">
          {rangePeople.map((p) => (
            <RangePersonCard
              key={p.userId}
              person={p}
              onSelectDay={(d) => {
                setDate(d);
                setMode('day');
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
