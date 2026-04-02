"use client";

import { Loader } from "lucide-react";

interface DashboardLoadingFallbackProps {
  componentName?: string;
}

export function DashboardLoadingFallback({
  componentName = "Dashboard",
}: DashboardLoadingFallbackProps) {
  return (
    <div className="flex h-64 items-center justify-center">
      <div className="space-y-4 text-center">
        <Loader className="mx-auto h-12 w-12 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground">Loading {componentName}...</p>
      </div>
    </div>
  );
}
