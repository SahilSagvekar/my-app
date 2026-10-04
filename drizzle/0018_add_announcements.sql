-- Announcements ("What's new") + per-user read receipts.
-- Mirrors src/lib/db/schema.ts and prisma/schema.prisma.
-- Idempotent: safe to re-run. Apply manually before deploying.

CREATE TABLE IF NOT EXISTS "Announcement" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"type" text DEFAULT 'NEW_FEATURE' NOT NULL,
	"linkUrl" text,
	"linkLabel" text,
	"audienceAll" boolean DEFAULT false NOT NULL,
	"audienceRoles" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"audienceUserIds" integer[] DEFAULT ARRAY[]::integer[] NOT NULL,
	"sendEmail" boolean DEFAULT false NOT NULL,
	"sendSlack" boolean DEFAULT false NOT NULL,
	"showPopup" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"publishAt" timestamp(3),
	"publishedAt" timestamp(3),
	"expiresAt" timestamp(3),
	"recipientCount" integer DEFAULT 0 NOT NULL,
	"emailSentCount" integer DEFAULT 0 NOT NULL,
	"createdById" integer NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS "Announcement_status_publishAt_idx" ON "Announcement" USING btree ("status", "publishAt");
CREATE INDEX IF NOT EXISTS "Announcement_publishedAt_idx" ON "Announcement" USING btree ("publishedAt");
DO $$ BEGIN ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE restrict ON UPDATE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "AnnouncementRead" (
	"id" text PRIMARY KEY NOT NULL,
	"announcementId" text NOT NULL,
	"userId" integer NOT NULL,
	"readAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"dismissedAt" timestamp(3)
);
CREATE UNIQUE INDEX IF NOT EXISTS "AnnouncementRead_announcementId_userId_key" ON "AnnouncementRead" USING btree ("announcementId", "userId");
CREATE INDEX IF NOT EXISTS "AnnouncementRead_userId_idx" ON "AnnouncementRead" USING btree ("userId");
DO $$ BEGIN ALTER TABLE "AnnouncementRead" ADD CONSTRAINT "AnnouncementRead_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE cascade ON UPDATE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "AnnouncementRead" ADD CONSTRAINT "AnnouncementRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE cascade ON UPDATE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
