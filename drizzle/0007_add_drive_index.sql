-- Files & Drive metadata index (see src/lib/drive/index-store.ts).
-- Postgres mirror of the R2 bucket so Drive listing, search, recent,
-- starred and trash never have to list R2. Populated by the one-time
-- backfill (POST /api/admin/drive-index/sync) and kept current by R2 event
-- notifications -> the `drive-events` Cloudflare Queue -> worker.ts.

CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "DriveItem" (
  "key" text PRIMARY KEY NOT NULL,
  "parentKey" text NOT NULL,
  "clientPrefix" text NOT NULL,
  "name" text NOT NULL,
  "isFolder" boolean DEFAULT false NOT NULL,
  "size" bigint DEFAULT 0 NOT NULL,
  "etag" text,
  "mimeType" text,
  "storageTier" text DEFAULT 'r2' NOT NULL,
  "lastModified" timestamp(3),
  "uploadedBy" integer,
  "pending" boolean DEFAULT false NOT NULL,
  "removedAt" timestamp(3),
  "trashedAt" timestamp(3),
  "trashedBy" integer,
  "trashRootKey" text,
  "hasThumbnail" boolean DEFAULT false NOT NULL,
  "previewStatus" text DEFAULT 'none' NOT NULL,
  "previewPrefix" text,
  "previewPriority" integer DEFAULT 0 NOT NULL,
  "previewAttempts" integer DEFAULT 0 NOT NULL,
  "previewError" text,
  "previewRequestedAt" timestamp(3),
  "previewStartedAt" timestamp(3),
  "durationSeconds" double precision,
  "width" integer,
  "height" integer,
  "lastEventAt" timestamp(3) NOT NULL,
  "lastSeenRunId" text,
  "createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint

-- Folder listing: WHERE key LIKE 'Company/%' — text_pattern_ops makes the
-- prefix LIKE an index range scan regardless of the DB collation.
CREATE INDEX IF NOT EXISTS "DriveItem_key_pattern_idx" ON "DriveItem" USING btree ("key" text_pattern_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "DriveItem_clientPrefix_idx" ON "DriveItem" USING btree ("clientPrefix");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "DriveItem_parentKey_idx" ON "DriveItem" USING btree ("parentKey");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "DriveItem_lastModified_idx" ON "DriveItem" USING btree ("lastModified" DESC)
  WHERE "removedAt" IS NULL AND "trashedAt" IS NULL AND "isFolder" = false AND "pending" = false;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "DriveItem_trashedAt_idx" ON "DriveItem" USING btree ("trashedAt") WHERE "trashedAt" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "DriveItem_previewStatus_idx" ON "DriveItem" USING btree ("previewStatus", "previewPriority" DESC, "previewRequestedAt")
  WHERE "previewStatus" IN ('queued', 'processing');
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "DriveItem_removedAt_idx" ON "DriveItem" USING btree ("removedAt") WHERE "removedAt" IS NOT NULL;
--> statement-breakpoint
-- Search-as-you-type on file names.
CREATE INDEX IF NOT EXISTS "DriveItem_name_trgm_idx" ON "DriveItem" USING gin ("name" gin_trgm_ops);
--> statement-breakpoint
-- Search also matches folder names in the path (old search did fullPath.includes(q)).
CREATE INDEX IF NOT EXISTS "DriveItem_key_trgm_idx" ON "DriveItem" USING gin ("key" gin_trgm_ops);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "DriveStar" (
  "userId" integer NOT NULL,
  "key" text NOT NULL,
  "createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT "DriveStar_pkey" PRIMARY KEY ("userId", "key")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "DriveStar_key_idx" ON "DriveStar" USING btree ("key");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "DriveActivity" (
  "id" text PRIMARY KEY NOT NULL,
  "key" text NOT NULL,
  "clientPrefix" text NOT NULL,
  "action" text NOT NULL,
  "userId" integer,
  "details" jsonb,
  "createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "DriveActivity_key_createdAt_idx" ON "DriveActivity" USING btree ("key", "createdAt" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "DriveActivity_clientPrefix_createdAt_idx" ON "DriveActivity" USING btree ("clientPrefix", "createdAt" DESC);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "DriveSyncRun" (
  "id" text PRIMARY KEY NOT NULL,
  "prefix" text DEFAULT '' NOT NULL,
  "status" text DEFAULT 'running' NOT NULL,
  "cursor" text,
  "startedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "finishedAt" timestamp(3),
  "listedCount" integer DEFAULT 0 NOT NULL,
  "tombstonedCount" integer DEFAULT 0 NOT NULL,
  "triggeredBy" text,
  "error" text
);
