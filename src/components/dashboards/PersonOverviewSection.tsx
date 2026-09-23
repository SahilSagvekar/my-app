'use client';

import { useState } from 'react';
import { FilterSelect } from '../ui/filter-select';
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
            <FilterSelect
              value={selectedEmployeeId ? String(selectedEmployeeId) : ''}
              onValueChange={(v) => setSelectedEmployeeId(Number(v))}
              placeholder="Pick a person…"
              className="h-8 w-48 text-xs"
              options={employees.map((e) => ({ value: String(e.id), label: `${e.name} — ${e.role}` }))}
            />
            <FilterSelect
              value={selectedMonth}
              onValueChange={setSelectedMonth}
              placeholder="All time"
              className="h-8 w-40 text-xs"
              options={[
                { value: "all", label: "All time" },
                ...availableMonths.map((m) => ({ value: m, label: m })),
              ]}
            />
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