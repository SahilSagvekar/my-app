// src/lib/hooks/useYouTubeAnalytics.ts

"use client";

import { useState, useEffect, useCallback } from "react";
import type { DateRange } from "@/types/youtube";

export function useYouTubeAnalytics(clientId: string, initialRange: DateRange = "28d") {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<DateRange>(initialRange);

  const fetchAnalytics = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/youtube/analytics?clientId=${clientId}&range=${range}`
      );
      if (!res.ok) throw new Error("Failed to fetch analytics");
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [clientId, range]);

  const triggerSync = useCallback(async () => {
    if (!clientId) return;
    setSyncing(true);

    try {
      const res = await fetch("/api/youtube/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Sync failed");
      }

      // Refetch data after sync
      await fetchAnalytics();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  }, [clientId, fetchAnalytics]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return {
    data,
    loading,
    syncing,
    error,
    range,
    setRange,
    refetch: fetchAnalytics,
    triggerSync,
  };
}

export function useAdminYouTubeAnalytics(initialRange: DateRange = "28d") {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<DateRange>(initialRange);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/youtube/admin-analytics?range=${range}`
      );
      if (!res.ok) throw new Error("Failed to fetch admin analytics");
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, range, setRange, refetch: fetchData };
}