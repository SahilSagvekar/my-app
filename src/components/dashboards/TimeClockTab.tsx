// FILE: src/components/dashboards/TimeClockTab.tsx
// New file. The "Time Clock" tab inside Production Tracker (admin/manager).
// Shows, per person, a merged timeline of clock-in/out + their task activity
// for a chosen EST calendar date.

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Loader2, Clock, LogIn, LogOut, AlertTriangle, ChevronDown, ChevronRight, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

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

function todayEST(): string {
  // Matches getESTDateString() on the server — just for the date input's default value.
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function formatTimeEST(iso: string): string {
  return (
    new Date(iso).toLocaleTimeString('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      minute: '2-digit',
    }) + ' EST'
  );
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
                Clocked in — {formatTimeEST(person.clockInAt)}
              </Badge>
            ) : (
              <span className="text-gray-500">
                {formatTimeEST(person.clockInAt)} – {person.clockOutAt ? formatTimeEST(person.clockOutAt) : '—'}
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
                  <span className="text-gray-400 ml-2">{formatTimeEST(event.at)}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export function TimeClockTab() {
  const [date, setDate] = useState(todayEST());
  const [people, setPeople] = useState<PersonDay[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/admin/production-tracker/time-clock?date=${date}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load');
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setPeople(data.people || []);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load time clock data.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [date]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Clock className="h-4 w-4 text-gray-400" />
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-auto"
        />
        <span className="text-xs text-gray-400">Times shown in EST</span>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {error && (
        <div className="text-sm text-red-600 py-8 text-center">{error}</div>
      )}

      {!loading && !error && people && people.length === 0 && (
        <div className="text-sm text-gray-400 py-16 text-center">
          Nobody clocked in on this date.
        </div>
      )}

      {!loading && !error && people && people.length > 0 && (
        <div className="space-y-3">
          {people.map((p) => (
            <PersonCard key={p.userId} person={p} />
          ))}
        </div>
      )}
    </div>
  );
}