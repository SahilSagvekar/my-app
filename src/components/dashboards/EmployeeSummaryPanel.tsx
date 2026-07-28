'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Loader2 } from 'lucide-react';

interface ByClient {
  clientId: string;
  clientName: string;
  count: number;
}
interface ByStatus {
  status: string;
  count: number;
}
interface SummaryData {
  employee: { id: number; name: string; role: string };
  totalTasks: number;
  byClient: ByClient[];
  byStatus: ByStatus[];
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  IN_PROGRESS: 'In Progress',
  READY_FOR_QC: 'Ready for QC',
  QC_IN_PROGRESS: 'QC in Progress',
  COMPLETED: 'Completed',
  SCHEDULED: 'Scheduled',
  ON_HOLD: 'On Hold',
  REJECTED: 'Rejected',
  CLIENT_REVIEW: 'Client Review',
  VIDEOGRAPHER_ASSIGNED: 'Videographer Assigned',
  POSTED: 'Posted',
  HIDDEN: 'Hidden',
};

// Simplest possible view: one number per client, one number per status.
// Pass month="all" for a lifetime total, or "July-2026" to scope it.
export function EmployeeSummaryPanel({
  employeeId,
  month = 'all',
}: {
  employeeId: number;
  month?: string;
}) {
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(
      `/api/admin/production-tracker/employee-summary?employeeId=${employeeId}&month=${month}`,
      { cache: 'no-store' }
    )
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [employeeId, month]);

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (!data) return null;

  const maxClientCount = Math.max(1, ...data.byClient.map((c) => c.count));
  const maxStatusCount = Math.max(1, ...data.byStatus.map((s) => s.count));

  return (
    <div className="space-y-4">
      <div className="flex items-baseline gap-2">
        <h3 className="text-lg font-semibold">{data.employee.name}</h3>
        <span className="text-sm text-muted-foreground">
          {data.totalTasks} total task{data.totalTasks === 1 ? '' : 's'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">By Client</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.byClient.length === 0 && (
              <p className="text-sm text-muted-foreground">No tasks assigned.</p>
            )}
            {data.byClient.map((c) => (
              <div key={c.clientId} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="truncate">{c.clientName}</span>
                  <span className="font-medium">{c.count}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${(c.count / maxClientCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">By Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.byStatus
              .filter((s) => s.count > 0)
              .sort((a, b) => b.count - a.count)
              .map((s) => (
                <div key={s.status} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{STATUS_LABELS[s.status] || s.status}</span>
                    <span className="font-medium">{s.count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${(s.count / maxStatusCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            {data.byStatus.every((s) => s.count === 0) && (
              <p className="text-sm text-muted-foreground">No tasks assigned.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}