// src/lib/hooks/useYouTubeAnalytics.ts
// Hook for fetching YouTube analytics with smart caching

"use client";

import { useState, useEffect, useCallback } from "react";
import type { DateRange } from "@/types/youtube";

export function useYouTubeAnalytics(clientId: string, initialRange: DateRange = "28d") {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<DateRange>(initialRange);

  // Fetch analytics data - uses cached data unless forceRefresh is true
  const fetchAnalytics = useCallback(async (forceRefresh = false) => {
    if (!clientId) return;

    // Only show loading spinner on initial load, not on refresh
    if (!data) {
      setLoading(true);
    }
    setError(null);

    try {
      const refreshParam = forceRefresh ? "&refresh=true" : "";
      const res = await fetch(
        `/api/youtube/analytics?clientId=${clientId}&range=${range}${refreshParam}`
      );
      if (!res.ok) throw new Error("Failed to fetch analytics");
      const json = await res.json();
      setData(json);

      // Log cache info for debugging
      if (json.cacheAge !== undefined) {
        console.log(`[YouTube Analytics] Cache age: ${json.cacheAge} minutes, refreshed: ${forceRefresh}`);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [clientId, range, data]);

  // Force refresh - fetches live data from YouTube API
  const triggerSync = useCallback(async () => {
    if (!clientId) return;
    setSyncing(true);

    try {
      // Call analytics API with refresh=true to force fresh data
      const res = await fetch(
        `/api/youtube/analytics?clientId=${clientId}&range=${range}&refresh=true`
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Refresh failed");
      }

      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  }, [clientId, range]);

  // Initial fetch (uses cache)
  useEffect(() => {
    fetchAnalytics(false);
  }, [clientId, range]); // Re-fetch when range changes

  return {
    data,
    loading,
    syncing,
    error,
    range,
    setRange,
    refetch: () => fetchAnalytics(false),
    triggerSync, // This now forces a refresh from YouTube API
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