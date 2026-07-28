'use client';

import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { EmployeeSummaryPanel } from './EmployeeSummaryPanel';

interface Employee {
  id: number;
  name: string;
  role: string;
}

// Pick a person, pick a month (or "All time"), see their task totals by
// client and status. `availableMonths` should be the same list already
// used by the page's main month selector (e.g. data.availableMonths).
export function PersonOverviewSection({
  employees,
  availableMonths,
}: {
  employees: Employee[];
  availableMonths: string[];
}) {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>('all');

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm font-bold">Person Overview</CardTitle>
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
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="h-8 text-xs w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All time</SelectItem>
                {availableMonths.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {selectedEmployeeId ? (
          <EmployeeSummaryPanel employeeId={selectedEmployeeId} month={selectedMonth} />
        ) : (
          <p className="text-sm text-muted-foreground py-8 text-center border rounded-md">
            Pick a person above to see their task totals by client and status.
          </p>
        )}
      </CardContent>
    </Card>
  );
}