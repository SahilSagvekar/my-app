-- Backfill Task.clientRejectionCount from the audit log, CURRENT MONTH only.
-- Run AFTER drizzle/0021_client_rejection_tracking.sql.
--
-- Counts audit rows written by /api/tasks/[id]/status when the CLIENT rejected a
-- task ("Task status updated to: REJECTED" / "...REJECTED_BY_CLIENT" with
-- metadata.role = 'client'). Only open tasks (not COMPLETED/SCHEDULED/POSTED) in the
-- current month are touched. Idempotent: it SETS the count (never lowers an existing
-- one), so it is safe to re-run.
--
-- Step 1 (preview):   run the SELECT below.
-- Step 2 (apply):     run the UPDATE.

-- Step 1: preview
WITH cur AS (
  SELECT to_char(now(), 'FMMonth') || '-' || to_char(now(), 'YYYY') AS folder,
         date_trunc('month', now()) AS start_of_month
),
counts AS (
  SELECT a."entityId" AS task_id, count(*)::int AS n, max(a."timestamp") AS last_at
  FROM "AuditLog" a
  WHERE a.entity = 'Task'
    AND a.details IN ('Task status updated to: REJECTED', 'Task status updated to: REJECTED_BY_CLIENT')
    AND lower(coalesce(a.metadata->>'role', '')) = 'client'
  GROUP BY a."entityId"
)
SELECT t.id, t.title, t.status, t."clientRejectionCount" AS current_count, c.n AS audit_count
FROM "Task" t
JOIN counts c ON c.task_id = t.id
CROSS JOIN cur
WHERE t.status NOT IN ('COMPLETED', 'SCHEDULED', 'POSTED')
  AND (t."monthFolder" = cur.folder OR (t."monthFolder" IS NULL AND t."createdAt" >= cur.start_of_month))
  AND c.n > t."clientRejectionCount";

-- Step 2: apply
WITH cur AS (
  SELECT to_char(now(), 'FMMonth') || '-' || to_char(now(), 'YYYY') AS folder,
         date_trunc('month', now()) AS start_of_month
),
counts AS (
  SELECT a."entityId" AS task_id, count(*)::int AS n, max(a."timestamp") AS last_at
  FROM "AuditLog" a
  WHERE a.entity = 'Task'
    AND a.details IN ('Task status updated to: REJECTED', 'Task status updated to: REJECTED_BY_CLIENT')
    AND lower(coalesce(a.metadata->>'role', '')) = 'client'
  GROUP BY a."entityId"
)
UPDATE "Task" t
SET "clientRejectionCount" = c.n,
    "lastClientRejectedAt" = c.last_at
FROM counts c, cur
WHERE c.task_id = t.id
  AND t.status NOT IN ('COMPLETED', 'SCHEDULED', 'POSTED')
  AND (t."monthFolder" = cur.folder OR (t."monthFolder" IS NULL AND t."createdAt" >= cur.start_of_month))
  AND c.n > t."clientRejectionCount";
