-- Adds the "No Action Required" flag for the Task Actions feature — editors
-- mark a task this way when none of tag/script/raw-footage/long-form/sponsor
-- apply. Combined with those, it gates Submit to QC (enforced in
-- /api/tasks/[id]/status) and is auto-cleared server-side the moment a real
-- action is taken.

ALTER TABLE "Task" ADD COLUMN "noActionRequired" boolean DEFAULT false NOT NULL;