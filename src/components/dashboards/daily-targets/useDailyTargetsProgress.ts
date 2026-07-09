"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProgressResponse } from './types';

const DEFAULT_POLL_MS = 18000; // within the 15-20s window requested

interface UseDailyTargetsProgressOptions {
  /** Scope the request to one client (lighter payload) — used by the detail drawer. */
  clientId?: string;
  /** Seed the date state, e.g. from the board's currently-selected date when opening the drawer. */
  initialDate?: string;
  /** Pass null/0 to disable polling entirely. */
  pollMs?: number | null;
}

export function useDailyTargetsProgress({
  clientId,
  initialDate = '',
  pollMs = DEFAULT_POLL_MS,
}: UseDailyTargetsProgressOptions = {}) {
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [data, setData] = useState<ProgressResponse | null>(null);
  const [loading, setLoading] = useState(true); // true only until the first successful/failed load completes
  const [isFetching, setIsFetching] = useState(false); // true for any fetch, foreground or background
  const inFlightRef = useRef(false);

  const fetchProgress = useCallback(async () => {
    if (inFlightRef.current) return; // skip overlapping poll ticks
    inFlightRef.current = true;
    setIsFetching(true);
    try {
      const params = new URLSearchParams();
      if (selectedDate) params.set('date', selectedDate);
      if (clientId) params.set('clientId', clientId);
      const res = await fetch(`/api/schedular/daily-targets/progress?${params}`);
      const json = await res.json();
      if (json.ok) setData(json);
    } catch (err) {
      console.error('Failed to fetch daily targets progress:', err);
    } finally {
      inFlightRef.current = false;
      setIsFetching(false);
      setLoading(false);
    }
  }, [selectedDate, clientId]);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  useEffect(() => {
    if (!pollMs) return;
    const id = setInterval(fetchProgress, pollMs);
    return () => clearInterval(id);
  }, [pollMs, fetchProgress]);

  const navigateDate = useCallback((direction: -1 | 1) => {
    const base = selectedDate || new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const [y, m, d] = base.split('-').map(Number);
    const next = new Date(y, m - 1, d + direction);
    setSelectedDate(next.toLocaleDateString('en-CA')); // always YYYY-MM-DD
  }, [selectedDate]);

  const goToToday = useCallback(() => setSelectedDate(''), []);

  return {
    data,
    loading,
    isFetching,
    selectedDate,
    setSelectedDate,
    navigateDate,
    goToToday,
    refetch: fetchProgress,
  };
}
