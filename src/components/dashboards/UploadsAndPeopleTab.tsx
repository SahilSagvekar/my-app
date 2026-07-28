'use client';

import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { UploadCalendarTab } from './UploadCalendarTab';
import { EmployeeSummaryPanel } from './EmployeeSummaryPanel';

interface Employee {
  id: number;
  name: string;
  role: string;
}

// One tab, two stacked sections:
//   1. Upload calendar — pick a date/range, see who uploaded what
//   2. Employee summary — pick one person, see their totals by client + status
//
// `employees` should be the same list you already fetch for the
// Editors/QC/Schedulers tabs (id, name, role) — just pass it through.
export function UploadsAndPeopleTab({
  employees,
  currentMonth,
}: {
  employees: Employee[];
  currentMonth: string;
}) {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [summaryScope, setSummaryScope] = useState<'all' | 'month'>('all');

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Upload Calendar
        </h3>
        <UploadCalendarTab employees={employees} currentMonth={currentMonth} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Person Overview
          </h3>
          <div className="flex items-center gap-2">
            <Select
              value={selectedEmployeeId ? String(selectedEmployeeId) : ''}
              onValueChange={(v) => setSelectedEmployeeId(Number(v))}
            >
              <SelectTrigger className="h-8 text-xs w-48">
                <SelectValue placeholder="Pick a person…" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={String(e.id)}>
                    {e.name} — {e.role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={summaryScope} onValueChange={(v: 'all' | 'month') => setSummaryScope(v)}>
              <SelectTrigger className="h-8 text-xs w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All time</SelectItem>
                <SelectItem value="month">This month</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {selectedEmployeeId ? (
          <EmployeeSummaryPanel
            employeeId={selectedEmployeeId}
            month={summaryScope === 'month' ? currentMonth : 'all'}
          />
        ) : (
          <p className="text-sm text-muted-foreground py-8 text-center border rounded-md">
            Pick a person above to see their task totals by client and status.
          </p>
        )}
      </div>
    </div>
  );
}