"use client";

import { useState, useEffect } from "react";
import { useAuth } from "./auth/AuthContext";
import { ViewAsRoleProvider, useViewAsRole } from "./auth/ViewAsRoleContext";
import { SearchProvider } from "./SearchContext";
import { LayoutShell } from "./LayoutShell";
import { getDefaultPage } from "./constants/navigation";
import { renderPage } from "./utils/pageRenderer";
import { PendingRoleScreen } from "./auth/PendingRoleScreen";

function AuthenticatedAppInner() {
  const { user, logout, loading } = useAuth();
  const { viewingAsRole } = useViewAsRole();
  const [currentPage, setCurrentPage] = useState(() =>
    getDefaultPage(viewingAsRole || user?.role || "admin")
  );

  // Reset page when role changes
  useEffect(() => {
    if (viewingAsRole) {
      setCurrentPage(getDefaultPage(viewingAsRole));
    }
  }, [viewingAsRole]);

  useEffect(() => {
    const savedPage = localStorage.getItem("returnToPage");
    if (savedPage) {
      console.log("Restoring page:", savedPage);
      localStorage.removeItem("returnToPage");
      setCurrentPage(savedPage);
    }
  }, []);

  const handlePageChange = (newPage: string) => {
    setCurrentPage(newPage);
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading application...</div>;
  if (!user) return <div className="flex items-center justify-center min-h-screen">Not logged in</div>;

  // 🔥 Handle user with no role assigned yet
  if (!user.role) {
    return <PendingRoleScreen user={user} onLogout={logout} />;
  }

  // Use viewingAsRole for UI, but keep actual user.role for auth purposes
  const displayRole = (viewingAsRole || user.role || "admin").toLowerCase();

  return (
    <SearchProvider>
      <LayoutShell
        currentRole={displayRole}
        currentPage={currentPage}
        onPageChange={handlePageChange}
        onLogout={logout}
      >
        {renderPage(displayRole, currentPage, handlePageChange, user.hasPostingServices)}
      </LayoutShell>
    </SearchProvider>
  );
}

export function AuthenticatedApp() {
  const { user, logout, loading } = useAuth();

  if (loading) return <div className="flex items-center justify-center min-h-screen">Preparing session...</div>;
  if (!user) return <div className="flex items-center justify-center min-h-screen">Redirecting to login...</div>;

  // 🔥 Handle user with no role assigned yet
  if (!user.role) {
    return <PendingRoleScreen user={user} onLogout={logout} />;
  }

  return (
    <ViewAsRoleProvider userEmail={user.email} userRole={user.role}>
      <AuthenticatedAppInner />
    </ViewAsRoleProvider>
  );
}
