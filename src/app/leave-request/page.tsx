"use client";

import LeaveRequestForm from "@/components/leaves/LeaveRequestForm";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-fetch";
import { useAuth } from "@/components/auth/AuthContext";
import { LayoutShell } from "@/components/LayoutShell";
import { NotificationProvider } from "@/components/NotificationContext";
import { SearchProvider } from "@/components/SearchContext";

export default function LeaveRequestPage() {
  const { user, logout, loading: authLoading } = useAuth();
  const [employee, setEmployee] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/auth/me") // get logged-in user
      .then((res) => {
        setEmployee(res.user);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  if (authLoading || loading) {
    return (
      <div className="p-8">
        <div className="text-center text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-8">
        <div className="text-center text-muted-foreground">Please log in to access this page</div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="p-8">
        <div className="text-center text-muted-foreground">Unable to load employee information</div>
      </div>
    );
  }

  return (
    <NotificationProvider currentRole={user.role}>
      <SearchProvider>
        <LayoutShell
          currentRole={user.role}
          currentPage="leave-request"
          onPageChange={() => {}}
          onLogout={logout}
        >
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold">Leave Request</h1>
              <p className="text-muted-foreground mt-2">
                Submit a leave request for approval. Select your dates and provide a reason for your absence.
              </p>
            </div>

            <LeaveRequestForm
              employeeId={employee.id}
              worksOnSaturday={employee.worksOnSaturday}
            />
          </div>
        </LayoutShell>
      </SearchProvider>
    </NotificationProvider>
  );
}
