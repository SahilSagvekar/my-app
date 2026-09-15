-- Create DeliverableScript (+ supporting enum/tables if missing)
-- Safe to re-run: uses IF NOT EXISTS throughout.

DO $$ BEGIN
  CREATE TYPE "RawFootageFolderCode" AS ENUM ('SF', 'LF');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "RawFootageFolder" (
  "id" TEXT PRIMARY KEY,
  "clientId" TEXT NOT NULL,
  "monthFolder" TEXT NOT NULL,
  "code" "RawFootageFolderCode" NOT NULL,
  "number" INTEGER NOT NULL,
  "folderPath" TEXT NOT NULL,
  "taskId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RawFootageFolder_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RawFootageFolder_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "RawFootageFolder_client_month_code_number_key"
  ON "RawFootageFolder" ("clientId", "monthFolder", "code", "number");
CREATE INDEX IF NOT EXISTS "RawFootageFolder_taskId_idx"
  ON "RawFootageFolder" ("taskId");

CREATE TABLE IF NOT EXISTS "DeliverableScript" (
  "id" TEXT PRIMARY KEY,
  "clientId" TEXT NOT NULL,
  "monthFolder" TEXT NOT NULL,
  "code" "RawFootageFolderCode" NOT NULL,
  "number" INTEGER NOT NULL,
  "rawFootageFolderId" TEXT NOT NULL,
  "taskId" TEXT,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL DEFAULT '',
  "template" TEXT NOT NULL DEFAULT 'overall',
  "status" TEXT NOT NULL DEFAULT 'draft',
  "versions" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "clientFeedback" TEXT,
  "reviewTaskId" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeliverableScript_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DeliverableScript_rawFootageFolderId_fkey"
    FOREIGN KEY ("rawFootageFolderId") REFERENCES "RawFootageFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DeliverableScript_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "DeliverableScript_client_month_code_number_key"
  ON "DeliverableScript" ("clientId", "monthFolder", "code", "number");
CREATE UNIQUE INDEX IF NOT EXISTS "DeliverableScript_rawFootageFolderId_key"
  ON "DeliverableScript" ("rawFootageFolderId");
CREATE INDEX IF NOT EXISTS "DeliverableScript_taskId_idx"
  ON "DeliverableScript" ("taskId");

CREATE TABLE IF NOT EXISTS "ScriptShootLink" (
  "id" TEXT PRIMARY KEY,
  "sourceShootTaskId" TEXT NOT NULL,
  "scriptId" TEXT NOT NULL,
  "targetShootTaskId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ScriptShootLink_sourceShootTaskId_fkey"
    FOREIGN KEY ("sourceShootTaskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ScriptShootLink_targetShootTaskId_fkey"
    FOREIGN KEY ("targetShootTaskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ScriptShootLink_scriptId_target_key"
  ON "ScriptShootLink" ("scriptId", "targetShootTaskId");
CREATE INDEX IF NOT EXISTS "ScriptShootLink_targetShootTaskId_idx"
  ON "ScriptShootLink" ("targetShootTaskId");

-- Optional Client flags used by the scripting feature
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "shootDaysPerMonth" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "scriptsRequired" BOOLEAN NOT NULL DEFAULT false;
