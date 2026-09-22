'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

interface Gap {
  clientId: string;
  clientName: string;
  deliverableId: string;
  type: string;
  target: number;
  ready: number;
  missing: number;
}

interface GapResponse {
  month: string;
  daysInMonth: number;
  gaps: Gap[];
}

// Shows the scheduler how many more tasks she still needs from editors
// today, per client + deliverable type. Pulls from
// /api/scheduler/deliverable-gaps — see that route for the target/ready
// definitions.
export function DeliverableGapTracker() {
  const [data, setData] = useState<GapResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const res = await fetch('/api/scheduler/deliverable-gaps', { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to load');
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Loading deliverable gaps…</p>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return null;
  }

  const shortClients = data.gaps.filter((g) => g.missing > 0);

  return (
    <div className="space-y-3">
      {/* Banner — only shows clients/types currently short */}
      {shortClients.length > 0 ? (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <h4 className="font-medium text-amber-900">
                  {shortClients.length} deliverable{shortClients.length > 1 ? 's' : ''} short today
                </h4>
                <ul className="mt-1 text-sm text-amber-800 space-y-0.5">
                  {shortClients.map((g) => (
                    <li key={`${g.clientId}-${g.deliverableId}`}>
                      <span className="font-semibold">{g.clientName}</span> needs{' '}
                      <span className="font-semibold">{g.missing}</span> more {g.type}
                      {g.missing > 1 ? 's' : ''} ({g.ready}/{g.target} ready)
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-green-300 bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
              <p className="text-sm text-green-900 font-medium">
                All clients have enough ready deliverables for today.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Per-client indicator table */}
      {data.gaps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Daily Deliverable Status</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 px-4 font-medium">Client</th>
                  <th className="py-2 px-4 font-medium">Type</th>
                  <th className="py-2 px-4 font-medium text-right">Target/Day</th>
                  <th className="py-2 px-4 font-medium text-right">Ready</th>
                  <th className="py-2 px-4 font-medium text-right">Missing</th>
                </tr>
              </thead>
              <tbody>
                {data.gaps.map((g) => (
                  <tr key={`${g.clientId}-${g.deliverableId}`} className="border-b last:border-0">
                    <td className="py-2 px-4">{g.clientName}</td>
                    <td className="py-2 px-4 uppercase text-muted-foreground">{g.type}</td>
                    <td className="py-2 px-4 text-right">{g.target}</td>
                    <td className="py-2 px-4 text-right">{g.ready}</td>
                    <td className="py-2 px-4 text-right">
                      {g.missing > 0 ? (
                        <span className="font-semibold text-amber-700">{g.missing}</span>
                      ) : (
                        <span className="text-green-700">0</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}