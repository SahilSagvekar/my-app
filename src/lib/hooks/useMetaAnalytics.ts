// src/lib/hooks/useMetaAnalytics.ts
"use client";

import { useState, useEffect, useCallback } from "react";
import { MetaAnalyticsData } from "@/types/meta";

export function useMetaAnalytics(clientId: string, initialRange = "28d") {
    const [data, setData] = useState<MetaAnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [range, setRange] = useState(initialRange);

    const fetchAnalytics = useCallback(async (forceRefresh = false) => {
        if (!clientId) return;

        if (!data) {
            setLoading(true);
        }
        setError(null);

        try {
            const url = new URL("/api/meta/analytics", window.location.origin);
            url.searchParams.set("clientId", clientId);
            url.searchParams.set("range", range);
            if (forceRefresh) url.searchParams.set("refresh", "true");

            const res = await fetch(url.toString());
            if (!res.ok) throw new Error("Failed to fetch Meta analytics");
            const result = await res.json();
            setData(result);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [clientId, range, data]);

    const triggerSync = useCallback(async () => {
        if (!clientId) return;
        setSyncing(true);
        setError(null);

        try {
            const res = await fetch(`/api/meta/sync?clientId=${clientId}`, {
                method: "POST",
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Sync failed");
            }

            // After successful sync, fetch updated analytics
            await fetchAnalytics(true);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSyncing(false);
        }
    }, [clientId, fetchAnalytics]);

    useEffect(() => {
        fetchAnalytics(false);
    }, [clientId, range]);

    return {
        data,
        loading,
        syncing,
        error,
        range,
        setRange,
        refetch: () => fetchAnalytics(false),
        triggerSync,
    };
}

export function useAdminMetaAnalytics(initialRange = "28d") {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [range, setRange] = useState(initialRange);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const res = await fetch(`/api/meta/admin-analytics?range=${range}`);
            if (!res.ok) throw new Error("Failed to fetch admin Meta analytics");
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
