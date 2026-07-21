"use client";

// src/components/tracking/SchedulerActivityTracker.tsx
//
// Mounted once in the root layout, active for the whole session. Fully a
// no-op for anyone whose role isn't "scheduler" — everyone else pays zero
// cost (no listeners attached at all).
//
// Design notes:
//  - Events are buffered in memory and flushed in batches (every
//    FLUSH_INTERVAL_MS), never sent one-per-click — a scheduler clicking
//    around all day should not turn into hundreds of individual HTTP
//    requests blocking the UI.
//  - The final flush on tab-close uses navigator.sendBeacon, which (unlike
//    a normal fetch) is guaranteed by the browser to actually go out even
//    as the page is unloading.
//  - userId is never sent from the client — the ingest route derives it
//    from the authenticated session server-side, so this can't be used to
//    spoof events under someone else's name.

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '../auth/AuthContext';
import {
  IDLE_THRESHOLD_MS,
  FLUSH_INTERVAL_MS,
  type SchedulerActivityEventInput,
  type SchedulerEventType,
} from '@/lib/scheduler-activity-shared';

const INGEST_URL = '/api/scheduler-tracking/events';
const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'] as const;

function describeTarget(el: Element | null): { label?: string; tag?: string } {
  if (!el) return {};
  const ariaLabel = el.getAttribute('aria-label');
  const testId = el.getAttribute('data-testid');
  const text = el.textContent?.trim().slice(0, 80);
  return {
    label: ariaLabel || testId || text || undefined,
    tag: el.tagName?.toLowerCase(),
  };
}

export function SchedulerActivityTracker() {
  const { user } = useAuth();
  const pathname = usePathname();
  const isScheduler = user?.role?.toLowerCase() === 'scheduler';

  const sessionIdRef = useRef<string>('');
  const bufferRef = useRef<SchedulerActivityEventInput[]>([]);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isIdleRef = useRef(false);

  if (!sessionIdRef.current) {
    sessionIdRef.current = crypto.randomUUID();
  }

  const push = (eventType: SchedulerEventType, extra?: Partial<SchedulerActivityEventInput>) => {
    bufferRef.current.push({
      sessionId: sessionIdRef.current,
      eventType,
      path: window.location.pathname,
      timestamp: new Date().toISOString(),
      ...extra,
    });
  };

  const flush = (useBeacon = false) => {
    if (bufferRef.current.length === 0) return;
    const batch = bufferRef.current;
    bufferRef.current = [];

    const body = JSON.stringify({ events: batch });

    if (useBeacon && navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon(INGEST_URL, blob);
    } else {
      fetch(INGEST_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body,
        keepalive: useBeacon, // best-effort even without sendBeacon support
      }).catch(() => {
        // Best-effort — dropped events aren't worth retrying/blocking on.
        // Put them back so the next flush picks them up, capped so a long
        // outage can't grow this unboundedly.
        bufferRef.current = [...batch, ...bufferRef.current].slice(-500);
      });
    }
  };

  // Track page navigations (Next.js client-side routing doesn't fire
  // normal browser navigation events, so this has to watch pathname).
  useEffect(() => {
    if (!isScheduler) return;
    push('navigation', { path: pathname });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, isScheduler]);

  useEffect(() => {
    if (!isScheduler) return;

    push('session_start');

    const handleClick = (e: MouseEvent) => {
      const el = e.target as Element | null;
      const { label, tag } = describeTarget(el?.closest('button, a, [role="button"], input, select, textarea') || el);
      push('click', { targetLabel: label, targetTag: tag });
    };

    const resetIdleTimer = () => {
      if (isIdleRef.current) {
        isIdleRef.current = false;
        push('idle_end');
      }
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        isIdleRef.current = true;
        push('idle_start');
      }, IDLE_THRESHOLD_MS);
    };

    const handleVisibility = () => {
      push(document.hidden ? 'visibility_hidden' : 'visibility_visible');
    };

    const handleUnload = () => {
      push('session_end');
      flush(true);
    };

    document.addEventListener('click', handleClick, true);
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, resetIdleTimer, { passive: true }));
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('beforeunload', handleUnload);
    resetIdleTimer();

    const flushInterval = setInterval(() => flush(false), FLUSH_INTERVAL_MS);

    return () => {
      document.removeEventListener('click', handleClick, true);
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, resetIdleTimer));
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleUnload);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      clearInterval(flushInterval);
      push('session_end');
      flush(true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isScheduler]);

  return null; // no UI — this is a pure side-effect component
}