"use client";

import LeaveRequestForm from "@/components/leaves/LeaveRequestForm";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-fetch";

export default function LeaveRequestPage() {
  const [employee, setEmployee] = useState<any>(null);

  useEffect(() => {
    apiFetch("/api/auth/me") // get logged-in user
      .then((res) => setEmployee(res.user))
      .catch(() => {});
  }, []);

  if (!employee) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold mb-6">
        Leave Request — {employee.name}
      </h1>

      <LeaveRequestForm
        employeeId={employee.id}
        worksOnSaturday={employee.worksOnSaturday}
      />
    </div>
  );
}
