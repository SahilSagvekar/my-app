'use client';

import { UploadCalendarTab } from './UploadCalendarTab';

interface Employee {
  id: number;
  name: string;
  role: string;
}

// Upload calendar — pick a date/range, see who uploaded what.
// (Person Overview now lives on the Overview tab, under All Client Progress.)
export function UploadsAndPeopleTab({
  employees,
  currentMonth,
}: {
  employees: Employee[];
  currentMonth: string;
}) {
  return <UploadCalendarTab employees={employees} currentMonth={currentMonth} />;
}