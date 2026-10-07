-- Three-strike discipline system: admins and videographers send strikes with a
-- reason; the 3rd active strike terminates the recipient's account.
-- Mirrors src/lib/db/schema.ts and prisma/schema.prisma.
-- Idempotent: safe to re-run. Apply manually before deploying.

CREATE TABLE IF NOT EXISTS "Strike" (
	"id" text PRIMARY KEY NOT NULL,
	"recipientId" integer NOT NULL,
	"senderId" integer NOT NULL,
	"reason" text NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"triggeredTermination" boolean DEFAULT false NOT NULL,
	"revokedAt" timestamp(3),
	"revokedById" integer,
	"revokeReason" text
);
CREATE INDEX IF NOT EXISTS "Strike_recipientId_revokedAt_idx" ON "Strike" USING btree ("recipientId", "revokedAt");
CREATE INDEX IF NOT EXISTS "Strike_senderId_idx" ON "Strike" USING btree ("senderId");
DO $$ BEGIN ALTER TABLE "Strike" ADD CONSTRAINT "Strike_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE cascade ON UPDATE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "Strike" ADD CONSTRAINT "Strike_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE restrict ON UPDATE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "Strike" ADD CONSTRAINT "Strike_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE set null ON UPDATE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
