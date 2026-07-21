'use client';

// src/components/admin/SchedulerActivityTab.tsx
// Admin-only view of scheduler activity: daily summaries (active/idle
// minutes, clicks, sessions) per scheduler, with a drill-down into the
// raw click/navigation timeline for any day within the 30-day retention
// window.

import { useEffect, useState, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

interface Scheduler {
  id: number;
  name: string | null;
  email: string;
}

interface DailySummary {
  userId: number;
  date: string;
  activeMinutes: number;
  idleMinutes: number;
  clickCount: number;
  sessionCount: number;
  firstEventAt: string | null;
  lastEventAt: string | null;
}

interface RawEvent {
  id: string;
  eventType: string;
  path: string | null;
  targetLabel: string | null;
  targetTag: string | null;
  timestamp: string;
}

function fmtMinutes(m: number) {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return h > 0 ? `${h}h ${mm}m` : `${mm}m`;
}

export function SchedulerActivityTab() {
  const [schedulers, setSchedulers] = useState<Scheduler[]>([]);
  const [summaries, setSummaries] = useState<DailySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [drilldown, setDrilldown] = useState<{ userId: number; date: string } | null>(null);
  const [rawEvents, setRawEvents] = useState<RawEvent[] | null>(null);
  const [drilldownLoading, setDrilldownLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/scheduler-activity?days=30');
      const json = await res.json();
      setSchedulers(json.schedulers || []);
      setSummaries(json.summaries || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openDrilldown = async (userId: number, date: string) => {
    setDrilldown({ userId, date });
    setDrilldownLoading(true);
    setRawEvents(null);
    try {
      const res = await fetch(`/api/admin/scheduler-activity?userId=${userId}&date=${date}`);
      const json = await res.json();
      setRawEvents(json.events || []);
    } finally {
      setDrilldownLoading(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-muted-foreground text-sm">Loading scheduler activity...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Scheduler Activity</h2>
        <Button variant="outline" size="sm" onClick={load}>Refresh</Button>
      </div>

      {schedulers.length === 0 && (
        <div className="text-sm text-muted-foreground">No scheduler-role users found.</div>
      )}

      {schedulers.map((sch) => {
        const rows = summaries
          .filter((s) => s.userId === sch.id)
          .sort((a, b) => (a.date < b.date ? 1 : -1));

        return (
          <Card key={sch.id}>
            <CardHeader>
              <CardTitle className="text-base">{sch.name || sch.email}</CardTitle>
            </CardHeader>
            <CardContent>
              {rows.length === 0 ? (
                <div className="text-sm text-muted-foreground">No activity recorded yet.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b">
                      <th className="py-1 pr-4">Date</th>
                      <th className="py-1 pr-4">Active</th>
                      <th className="py-1 pr-4">Idle</th>
                      <th className="py-1 pr-4">Clicks</th>
                      <th className="py-1 pr-4">Sessions</th>
                      <th className="py-1 pr-4">First / Last activity</th>
                      <th className="py-1"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const dateStr = row.date.slice(0, 10);
                      const idlePct = row.activeMinutes + row.idleMinutes > 0
                        ? Math.round((row.idleMinutes / (row.activeMinutes + row.idleMinutes)) * 100)
                        : 0;
                      return (
                        <tr key={dateStr} className="border-b last:border-0">
                          <td className="py-2 pr-4">{dateStr}</td>
                          <td className="py-2 pr-4">{fmtMinutes(row.activeMinutes)}</td>
                          <td className="py-2 pr-4">
                            {fmtMinutes(row.idleMinutes)}
                            {idlePct >= 50 && <Badge variant="destructive" className="ml-2">{idlePct}% idle</Badge>}
                          </td>
                          <td className="py-2 pr-4">{row.clickCount}</td>
                          <td className="py-2 pr-4">{row.sessionCount}</td>
                          <td className="py-2 pr-4 text-muted-foreground">
                            {row.firstEventAt ? new Date(row.firstEventAt).toLocaleTimeString() : '—'}
                            {' – '}
                            {row.lastEventAt ? new Date(row.lastEventAt).toLocaleTimeString() : '—'}
                          </td>
                          <td className="py-2">
                            <Button variant="ghost" size="sm" onClick={() => openDrilldown(sch.id, dateStr)}>
                              View timeline
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        );
      })}

      {drilldown && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              Timeline — {schedulers.find((s) => s.id === drilldown.userId)?.name || ''} — {drilldown.date}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setDrilldown(null)}>Close</Button>
          </CardHeader>
          <CardContent>
            {drilldownLoading ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : !rawEvents || rawEvents.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No raw events available for this day (older than the 30-day retention window, or nothing was recorded).
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto space-y-1 text-xs font-mono">
                {rawEvents.map((e) => (
                  <div key={e.id} className="flex gap-3 py-1 border-b last:border-0">
                    <span className="text-muted-foreground shrink-0 w-20">
                      {new Date(e.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="shrink-0 w-28">{e.eventType}</span>
                    <span className="text-muted-foreground truncate">
                      {e.path} {e.targetLabel ? `— ${e.targetLabel}` : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}