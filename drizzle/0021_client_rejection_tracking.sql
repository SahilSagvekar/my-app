-- Persistent "rejected by client" tracking + Final Revision flag.
-- Mirrors src/lib/db/schema.ts and prisma/schema.prisma. Idempotent.
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "clientRejectionCount" integer DEFAULT 0 NOT NULL;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "lastClientRejectedAt" timestamp(3);
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "isFinalRevision" boolean DEFAULT false NOT NULL;
CREATE INDEX IF NOT EXISTS "Task_clientRejectionCount_status_idx" ON "Task" ("clientRejectionCount", "status");
