"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProgressResponse } from './types';

const DEFAULT_POLL_MS = 15000;

interface UseDailyTargetsProgressOptions {
  /** Scope the request to one client (lighter payload) — used by the detail drawer. */
  clientId?: string;
  /** Seed the date state, e.g. from the board's currently-selected date when opening the drawer. */
  initialDate?: string;
  /** Pass null/0 to disable polling entirely. */
  pollMs?: number | null;
  /** Skip fetching + polling entirely (e.g. drawer while closed). */
  enabled?: boolean;
}

export function useDailyTargetsProgress({
  clientId,
  initialDate = '',
  pollMs = DEFAULT_POLL_MS,
  enabled = true,
}: UseDailyTargetsProgressOptions = {}) {
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [data, setData] = useState<ProgressResponse | null>(null);
  const [loading, setLoading] = useState(true); // true only until the first load completes
  const [isFetching, setIsFetching] = useState(false); // any fetch, foreground or background
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [error, setError] = useState(false); // last poll failed; stale data stays on screen
  const inFlightRef = useRef(false);
  const requestKeyRef = useRef('');

  const fetchProgress = useCallback(async () => {
    const key = `${selectedDate}|${clientId ?? ''}`;
    if (inFlightRef.current && requestKeyRef.current === key) return; // skip overlapping poll ticks (but never block a date/client change)
    inFlightRef.current = true;
    requestKeyRef.current = key;
    setIsFetching(true);
    try {
      const params = new URLSearchParams();
      if (selectedDate) params.set('date', selectedDate);
      if (clientId) params.set('clientId', clientId);
      const res = await fetch(`/api/schedular/daily-targets/progress?${params}`, { cache: 'no-store' });
      const json = await res.json();
      // Ignore a response for a date/client the user has already navigated away from.
      if (json.ok && requestKeyRef.current === key) {
        setData(json);
        setLastUpdated(Date.now());
        setError(false);
      } else if (!json.ok) {
        setError(true);
      }
    } catch (err) {
      console.error('Failed to fetch posting tracker progress:', err);
      setError(true);
    } finally {
      inFlightRef.current = false;
      setIsFetching(false);
      setLoading(false);
    }
  }, [selectedDate, clientId]);

  // Fetch immediately whenever the date/client changes.
  useEffect(() => {
    if (!enabled) return;
    fetchProgress();
  }, [fetchProgress, enabled]);

  // Live polling — only while the tab is visible; catch up instantly when it becomes visible/focused again.
  useEffect(() => {
    if (!enabled || !pollMs) return;

    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer) return;
      timer = setInterval(fetchProgress, pollMs);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchProgress();
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onVisibility);
    };
  }, [enabled, pollMs, fetchProgress]);

  const navigateDate = useCallback((direction: -1 | 1) => {
    const base = selectedDate || new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const [y, m, d] = base.split('-').map(Number);
    const next = new Date(Date.UTC(y, m - 1, d + direction));
    setSelectedDate(next.toISOString().slice(0, 10)); // always YYYY-MM-DD
  }, [selectedDate]);

  const goToToday = useCallback(() => setSelectedDate(''), []);

  return {
    data,
    loading,
    isFetching,
    lastUpdated,
    error,
    selectedDate,
    setSelectedDate,
    navigateDate,
    goToToday,
    refetch: fetchProgress,
  };
}
