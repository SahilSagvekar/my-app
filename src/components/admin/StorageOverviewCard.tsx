'use client';

import { useEffect, useState, useCallback } from 'react';
import { HardDrive, Cloud, RefreshCw, AlertTriangle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Progress } from '../ui/progress';
import { Button } from '../ui/button';

interface StorageSide {
  used: number;
  total: number | null;
  available: number | null;
  percentage: number | null;
  objectCount: number | null;
  asOf: string | null;
  error: string | null;
  usedFormatted: string;
  totalFormatted: string | null;
  availableFormatted: string | null;
}

interface StorageOverviewResponse {
  nas: StorageSide;
  r2: StorageSide;
}

function barColor(percentage: number | null) {
  if (percentage == null) return undefined;
  if (percentage >= 95) return '#ef4444'; // red
  if (percentage >= 85) return '#f59e0b'; // amber
  return undefined; // default theme color
}

export function StorageOverviewCard() {
  const [data, setData] = useState<StorageOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/storage-overview');
      const json = await res.json();
      setData(json);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Storage</CardTitle>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* NAS */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <HardDrive className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">NAS</span>
          </div>
          {data?.nas.error ? (
            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 rounded-md p-2">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500" />
              <span>{data.nas.error}</span>
            </div>
          ) : data?.nas ? (
            <>
              <Progress value={data.nas.percentage ?? 0} indicatorColor={barColor(data.nas.percentage)} />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>
                  {data.nas.usedFormatted} used
                  {data.nas.objectCount != null && ` · ${data.nas.objectCount.toLocaleString()} objects`}
                </span>
                <span>{data.nas.availableFormatted} free of {data.nas.totalFormatted}</span>
              </div>
            </>
          ) : (
            <div className="h-2 w-full rounded-full bg-muted animate-pulse" />
          )}
        </div>

        {/* Cloudflare R2 */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Cloud className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Cloudflare R2</span>
          </div>
          {data?.r2.error ? (
            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 rounded-md p-2">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500" />
              <span>{data.r2.error}</span>
            </div>
          ) : data?.r2 ? (
            <div className="text-sm">
              <span className="font-medium">{data.r2.usedFormatted}</span>
              <span className="text-muted-foreground"> stored</span>
              {data.r2.objectCount != null && (
                <span className="text-muted-foreground"> · {data.r2.objectCount.toLocaleString()} objects</span>
              )}
              {data.r2.asOf && (
                <div className="text-xs text-muted-foreground mt-1">
                  As of {new Date(data.r2.asOf).toLocaleString()} (Cloudflare's own analytics can lag actual writes by up to ~1hr)
                </div>
              )}
              <div className="text-xs text-muted-foreground mt-1">
                No fixed storage cap on this plan — pay-as-you-go.
              </div>
            </div>
          ) : (
            <div className="h-4 w-32 rounded bg-muted animate-pulse" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}