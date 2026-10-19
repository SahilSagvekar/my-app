-- Backfill Task.clientRejectionCount / lastClientRejectedAt from the audit log,
-- ALL TIME, ALL STATUSES.
--
-- Why this exists: the client portal's "Rejected" tab is now a permanent history
-- of every task the client has ever rejected (clientRejectionCount > 0), whatever
-- its status is today — including tasks that were later approved or posted.
-- scripts/backfill-client-rejections.sql only covered the CURRENT MONTH and
-- skipped COMPLETED / SCHEDULED / POSTED tasks, so older rejections (and every
-- rejected-then-approved task) would be missing from that tab.
--
-- Run AFTER drizzle/0021_client_rejection_tracking.sql.
--
-- Source of truth: audit rows written by /api/tasks/[id]/status when the CLIENT
-- rejected a task ("Task status updated to: REJECTED" for older rows,
-- "...REJECTED_BY_CLIENT" for newer ones, with metadata.role = 'client').
--
-- Safe to re-run: it only ever RAISES a count (never lowers it), so rejections
-- recorded live since the tracking column was added are preserved. If the audit
-- log doesn't reach back that far, older rejections can't be recovered from it.
--
-- Step 1 (preview, changes nothing): run the two SELECTs.
-- Step 2 (apply): run the UPDATE.

-- ── Step 1a: how many tasks would change, by current status ─────────────────
WITH counts AS (
  SELECT a."entityId" AS task_id, count(*)::int AS n, max(a."timestamp") AS last_at
  FROM "AuditLog" a
  WHERE a.entity = 'Task'
    AND a.details IN ('Task status updated to: REJECTED', 'Task status updated to: REJECTED_BY_CLIENT')
    AND lower(coalesce(a.metadata->>'role', '')) = 'client'
  GROUP BY a."entityId"
)
SELECT t.status, count(*) AS tasks_to_update, sum(c.n - t."clientRejectionCount") AS rejections_added
FROM "Task" t
JOIN counts c ON c.task_id = t.id
WHERE c.n > t."clientRejectionCount"
GROUP BY t.status
ORDER BY tasks_to_update DESC;

-- ── Step 1b: row-level preview ───────────────────────────────────────────────
WITH counts AS (
  SELECT a."entityId" AS task_id, count(*)::int AS n, max(a."timestamp") AS last_at
  FROM "AuditLog" a
  WHERE a.entity = 'Task'
    AND a.details IN ('Task status updated to: REJECTED', 'Task status updated to: REJECTED_BY_CLIENT')
    AND lower(coalesce(a.metadata->>'role', '')) = 'client'
  GROUP BY a."entityId"
)
SELECT t.id, t.title, t."clientId", t.status, t."monthFolder",
       t."clientRejectionCount" AS current_count, c.n AS audit_count, c.last_at
FROM "Task" t
JOIN counts c ON c.task_id = t.id
WHERE c.n > t."clientRejectionCount"
ORDER BY c.last_at DESC;

-- ── Step 2: apply ────────────────────────────────────────────────────────────
WITH counts AS (
  SELECT a."entityId" AS task_id, count(*)::int AS n, max(a."timestamp") AS last_at
  FROM "AuditLog" a
  WHERE a.entity = 'Task'
    AND a.details IN ('Task status updated to: REJECTED', 'Task status updated to: REJECTED_BY_CLIENT')
    AND lower(coalesce(a.metadata->>'role', '')) = 'client'
  GROUP BY a."entityId"
)
UPDATE "Task" t
SET "clientRejectionCount" = c.n,
    "lastClientRejectedAt" = greatest(coalesce(t."lastClientRejectedAt", c.last_at), c.last_at)
FROM counts c
WHERE c.task_id = t.id
  AND c.n > t."clientRejectionCount";
