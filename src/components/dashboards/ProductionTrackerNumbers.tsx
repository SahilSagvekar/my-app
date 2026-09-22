'use client';

import { Fragment, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Loader2 } from 'lucide-react';

// ─── Types (mirrors /api/admin/production-tracker-numbers) ───

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

interface NumbersData {
  month: string;
  totalTasks: number;
  editorTaskLoad: EditorTaskLoad[];
  editorIncomplete: EditorIncomplete[];
  editorRejectionRank: EditorRejectionRank[];
  editorTopRejectionReasons: EditorTopRejectionReason[];
  clientRemainingDeliverables: ClientRemaining[];
  statusCounts: StatusCount[];
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  VIDEOGRAPHER_ASSIGNED: 'Videographer Assigned',
  IN_PROGRESS: 'In Progress',
  READY_FOR_QC: 'Ready For QC',
  QC_IN_PROGRESS: 'QC In Progress',
  REJECTED_BY_QC: 'Rejected By QC',
  CLIENT_REVIEW: 'Client Review',
  REJECTED_BY_CLIENT: 'Rejected By Client',
  ON_HOLD: 'On Hold',
  COMPLETED: 'Completed',
  SCHEDULED: 'Scheduled',
  POSTED: 'Posted',
};

export function ProductionTrackerNumbers({ month }: { month?: string }) {
  const [data, setData] = useState<NumbersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedEditor, setExpandedEditor] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const url = month
      ? `/api/admin/production-tracker-numbers?month=${encodeURIComponent(month)}`
      : '/api/admin/production-tracker-numbers';
    fetch(url, { cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch');
        return res.json();
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err) => console.error('Production tracker numbers fetch error:', err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
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

  return (
    <div className="space-y-6">
      {/* ─── 6. All statuses this month ─── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold">
            Task Statuses — {data.month} ({data.totalTasks} total)
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground uppercase tracking-wider">
                <th className="py-2 font-medium">Status</th>
                <th className="py-2 font-medium text-right">Count</th>
              </tr>
            </thead>
            <tbody>
              {data.statusCounts.map((s) => (
                <tr key={s.status} className="border-b last:border-0">
                  <td className="py-2">{STATUS_LABELS[s.status] || s.status}</td>
                  <td className="py-2 text-right font-semibold">{s.count}</td>
                </tr>
              ))}
              {data.statusCounts.length === 0 && (
                <tr>
                  <td colSpan={2} className="py-4 text-center text-muted-foreground">
                    No tasks this month.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ─── 1. Editor task load ─── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold">Editor Task Load</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground uppercase tracking-wider">
                  <th className="py-2 font-medium">Editor</th>
                  <th className="py-2 font-medium text-right">Tasks This Month</th>
                </tr>
              </thead>
              <tbody>
                {data.editorTaskLoad.map((e) => (
                  <tr key={e.editorId} className="border-b last:border-0">
                    <td className="py-2">{e.editorName}</td>
                    <td className="py-2 text-right font-semibold">{e.taskCount}</td>
                  </tr>
                ))}
                {data.editorTaskLoad.length === 0 && (
                  <tr>
                    <td colSpan={2} className="py-4 text-center text-muted-foreground">
                      No editors found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* ─── 2. Editor incomplete ─── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold">Editor Incomplete Tasks</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground uppercase tracking-wider">
                  <th className="py-2 font-medium">Editor</th>
                  <th className="py-2 font-medium text-right">Done</th>
                  <th className="py-2 font-medium text-right">Remaining</th>
                  <th className="py-2 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.editorIncomplete.map((e) => (
                  <tr key={e.editorId} className="border-b last:border-0">
                    <td className="py-2">{e.editorName}</td>
                    <td className="py-2 text-right">{e.done}</td>
                    <td className="py-2 text-right font-semibold">
                      {e.remaining > 0 ? e.remaining : <span className="text-muted-foreground">0</span>}
                    </td>
                    <td className="py-2 text-right">{e.total}</td>
                  </tr>
                ))}
                {data.editorIncomplete.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-muted-foreground">
                      No editors with tasks this month.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* ─── 3. Editor rejection rank ─── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold">Editor Rejection Count</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground uppercase tracking-wider">
                  <th className="py-2 font-medium">Editor</th>
                  <th className="py-2 font-medium text-right">Rejected Tasks</th>
                </tr>
              </thead>
              <tbody>
                {data.editorRejectionRank.map((e) => (
                  <tr key={e.editorId} className="border-b last:border-0">
                    <td className="py-2">{e.editorName}</td>
                    <td className="py-2 text-right font-semibold">{e.rejectCount}</td>
                  </tr>
                ))}
                {data.editorRejectionRank.length === 0 && (
                  <tr>
                    <td colSpan={2} className="py-4 text-center text-muted-foreground">
                      No rejections this month.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* ─── 4. Repeat rejection reason per editor ─── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold">Top Rejection Reason Per Editor</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground uppercase tracking-wider">
                  <th className="py-2 font-medium">Editor</th>
                  <th className="py-2 font-medium">Top Reason</th>
                  <th className="py-2 font-medium text-right">Count</th>
                </tr>
              </thead>
              <tbody>
                {data.editorTopRejectionReasons.map((e) => (
                  <Fragment key={e.editorId}>
                    <tr
                      className="border-b last:border-0 cursor-pointer hover:bg-gray-50"
                      onClick={() =>
                        setExpandedEditor(expandedEditor === e.editorId ? null : e.editorId)
                      }
                    >
                      <td className="py-2">{e.editorName}</td>
                      <td className="py-2">{e.topReason}</td>
                      <td className="py-2 text-right font-semibold">{e.topReasonCount}</td>
                    </tr>
                    {expandedEditor === e.editorId && e.allReasons.length > 1 && (
                      <tr className="border-b last:border-0 bg-gray-50/60">
                        <td colSpan={3} className="py-2 px-2">
                          <ul className="text-xs text-muted-foreground space-y-1">
                            {e.allReasons.map((r) => (
                              <li key={r.reason} className="flex justify-between">
                                <span>{r.reason}</span>
                                <span className="font-medium">{r.count}</span>
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {data.editorTopRejectionReasons.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-muted-foreground">
                      No rejection feedback logged this month.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {/* ─── 5. Client remaining deliverables ─── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold">Client Remaining Deliverables</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground uppercase tracking-wider">
                <th className="py-2 font-medium">Client</th>
                <th className="py-2 font-medium">Deliverable Type</th>
                <th className="py-2 font-medium text-right">Promised</th>
                <th className="py-2 font-medium text-right">Done</th>
                <th className="py-2 font-medium text-right">Remaining</th>
              </tr>
            </thead>
            <tbody>
              {data.clientRemainingDeliverables.map((c) =>
                c.deliverables
                  .filter((d) => d.remaining > 0)
                  .map((d, i) => (
                    <tr key={`${c.clientId}-${d.deliverableId}`} className="border-b last:border-0">
                      <td className="py-2">{i === 0 ? c.clientName : ''}</td>
                      <td className="py-2">{d.type}</td>
                      <td className="py-2 text-right">{d.promised}</td>
                      <td className="py-2 text-right">{d.done}</td>
                      <td className="py-2 text-right font-semibold">{d.remaining}</td>
                    </tr>
                  ))
              )}
              {data.clientRemainingDeliverables.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-muted-foreground">
                    No clients with remaining deliverables.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}