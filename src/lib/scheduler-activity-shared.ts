// src/lib/scheduler-activity-shared.ts
// Shared constants/types between the client-side tracker and the server
// routes that ingest/roll up the data. Kept dependency-free (no prisma
// import) so it's safe to import from client components.

export const IDLE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes of no activity
export const FLUSH_INTERVAL_MS = 8 * 1000;       // batch-send every 8s
export const RAW_RETENTION_DAYS = 30;

export type SchedulerEventType =
  | 'session_start'
  | 'session_end'
  | 'click'
  | 'navigation'
  | 'idle_start'
  | 'idle_end'
  | 'visibility_hidden'
  | 'visibility_visible';

export interface SchedulerActivityEventInput {
  sessionId: string;
  eventType: SchedulerEventType;
  path?: string;
  targetLabel?: string;
  targetTag?: string;
  metadata?: Record<string, unknown>;
  timestamp: string; // ISO — set client-side at the moment of the event, not at flush time
}