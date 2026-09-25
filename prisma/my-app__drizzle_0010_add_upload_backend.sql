-- Backup upload system: which bucket a file's bytes live in, plus the
-- singleton table backing the admin Primary/Backup switch.
ALTER TABLE "File" ADD COLUMN "storageBackend" TEXT NOT NULL DEFAULT 'r2';
CREATE INDEX "File_storageBackend_idx" ON "File" ("storageBackend");

CREATE TABLE "UploadBackendConfig" (
  "id" TEXT PRIMARY KEY,
  "activeBackend" TEXT NOT NULL DEFAULT 'r2',
  "switchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "switchedBy" INTEGER,
  "migrationInProgress" BOOLEAN NOT NULL DEFAULT false,
  "lastCanaryAt" TIMESTAMP(3),
  "lastCanaryOk" BOOLEAN,
  "lastCanaryError" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "UploadBackendConfig" ("id", "activeBackend") VALUES ('singleton', 'r2');
