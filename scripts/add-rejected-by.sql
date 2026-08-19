-- Filter metadata only: Task.status stays REJECTED.
-- Values: 'QC' | 'CLIENT' | 'SCHEDULER' | NULL
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "rejectedBy" TEXT;
CREATE INDEX IF NOT EXISTS "Task_rejectedBy_idx" ON "Task" ("rejectedBy");
