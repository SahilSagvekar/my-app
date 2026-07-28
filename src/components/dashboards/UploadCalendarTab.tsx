'use client';

import { useEffect, useState } from 'react';
import { Calendar } from '../ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Loader2, Upload } from 'lucide-react';
import type { DateRange } from 'react-day-picker';

interface Employee {
  id: number;
  name: string;
  role: string;
}

interface UploadRow {
  fileId: string;
  fileName: string;
  uploadedAt: string;
  employeeId: number | null;
  employeeName: string;
  taskTitle?: string;
  taskStatus?: string;
  clientName?: string;
}

interface Props {
  employees: Employee[]; // pass in editors/qc/videographers list you already fetch elsewhere
  currentMonth: string; // e.g. "July-2026", used to load the day-count dots
}

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function UploadCalendarTab({ employees, currentMonth }: Props) {
  const [range, setRange] = useState<DateRange | undefined>(undefined);
  const [employeeFilter, setEmployeeFilter] = useState<string>('all');
  const [dayCounts, setDayCounts] = useState<Record<string, number>>({});
  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const [loadingCounts, setLoadingCounts] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Load per-day counts for the visible month so days with uploads show a dot.
  useEffect(() => {
    setLoadingCounts(true);
    const params = new URLSearchParams({ mode: 'counts', month: currentMonth });
    if (employeeFilter !== 'all') params.set('employeeId', employeeFilter);
    fetch(`/api/admin/production-tracker/uploads?${params}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((json) => setDayCounts(json.counts || {}))
      .finally(() => setLoadingCounts(false));
  }, [currentMonth, employeeFilter]);

  // Load the actual list whenever a date/range is picked.
  useEffect(() => {
    if (!range?.from) {
      setUploads([]);
      return;
    }
    setLoadingDetail(true);
    const params = new URLSearchParams({
      from: toISODate(range.from),
      to: toISODate(range.to || range.from),
    });
    if (employeeFilter !== 'all') params.set('employeeId', employeeFilter);
    fetch(`/api/admin/production-tracker/uploads?${params}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((json) => setUploads(json.uploads || []))
      .finally(() => setLoadingDetail(false));
  }, [range, employeeFilter]);

  const daysWithUploads = Object.entries(dayCounts)
    .filter(([, count]) => count > 0)
    .map(([date]) => new Date(`${date}T00:00:00`));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between">
            <span>Upload calendar</span>
            {loadingCounts && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="All employees" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All employees</SelectItem>
              {employees.map((e) => (
                <SelectItem key={e.id} value={String(e.id)}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Calendar
            mode="range"
            selected={range}
            onSelect={setRange}
            modifiers={{ hasUploads: daysWithUploads }}
            modifiersClassNames={{
              hasUploads: "after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:rounded-full after:bg-primary",
            }}
            className="rounded-md border"
          />
          <p className="text-[11px] text-muted-foreground">
            Dots mark days with uploads. Click a day, or drag to select a range.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Upload className="h-4 w-4" />
            {range?.from
              ? `Uploads: ${toISODate(range.from)}${
                  range.to && toISODate(range.to) !== toISODate(range.from)
                    ? ` → ${toISODate(range.to)}`
                    : ''
                }`
              : 'Pick a date to see uploads'}
            {loadingDetail && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {!loadingDetail && range?.from && (
              <Badge variant="secondary">{uploads.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {uploads.length === 0 && range?.from && !loadingDetail && (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No uploads in this range.
            </p>
          )}
          <div className="space-y-1 max-h-[560px] overflow-y-auto">
            {uploads.map((u) => (
              <div
                key={u.fileId}
                className="flex items-center justify-between gap-3 py-2 px-3 rounded-md border text-sm hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">{u.fileName}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {u.taskTitle || 'Untitled task'} · {u.clientName || 'No client'}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-medium">{u.employeeName}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(u.uploadedAt).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}