"use client";

import { useEffect, useState } from "react";

import type {
  ActivityData,
  ClientProgress,
  DashboardOverviewResponse,
  KPIData,
} from "./types";

interface UseAdminDashboardOverviewOptions {
  enabled?: boolean;
}

interface UseAdminDashboardOverviewResult {
  kpiData: KPIData | null;
  recentActivity: ActivityData[];
  clientProgress: ClientProgress[];
  loading: boolean;
  refreshing: boolean;
  refreshNonce: number;
  reload: () => Promise<void>;
  handleTaskCreated: () => Promise<void>;
}

export function useAdminDashboardOverview(
  options: UseAdminDashboardOverviewOptions = {},
): UseAdminDashboardOverviewResult {
  const { enabled = true } = options;
  const [kpiData, setKpiData] = useState<KPIData | null>(null);
  const [recentActivity, setRecentActivity] = useState<ActivityData[]>([]);
  const [clientProgress, setClientProgress] = useState<ClientProgress[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);

  async function loadDashboardData(showLoader = true) {
    try {
      if (showLoader) {
        setLoading(true);
      }

      const response = await fetch("/api/admin/dashboard/overview", {
        cache: "no-store",
      });
      const data: DashboardOverviewResponse = await response.json();

      if (!response.ok || !data.ok) {
        const message = data.message ?? response.statusText;
        if (response.status === 401 || response.status === 403) {
          console.warn("Admin dashboard overview is not available yet:", message);
        } else {
          console.error("Failed to fetch admin dashboard overview:", message);
        }
        return;
      }

      setKpiData(data.kpi ?? null);
      setRecentActivity(data.recentActivity ?? []);
      setClientProgress(data.clientDeliverablesProgress ?? []);
    } catch (error) {
      console.error("Failed to fetch admin dashboard overview:", error);
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    void loadDashboardData();
  }, [enabled]);

  async function reload() {
    setRefreshing(true);

    try {
      await loadDashboardData(false);
      setRefreshNonce((value) => value + 1);
    } finally {
      setRefreshing(false);
    }
  }

  async function handleTaskCreated() {
    await reload();
  }

  return {
    kpiData,
    recentActivity,
    clientProgress,
    loading,
    refreshing,
    refreshNonce,
    reload,
    handleTaskCreated,
  };
}
