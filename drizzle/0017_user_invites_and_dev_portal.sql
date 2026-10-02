-- User invites + Dev portal tickets. Mirrors src/lib/db/schema.ts and prisma/schema.prisma.
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS "UserInvite" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"role" "Role" NOT NULL,
	"tokenHash" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"invitedById" integer NOT NULL,
	"expiresAt" timestamp(3) NOT NULL,
	"acceptedAt" timestamp(3),
	"acceptedUserId" integer,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "UserInvite_tokenHash_key" ON "UserInvite" USING btree ("tokenHash");
CREATE INDEX IF NOT EXISTS "UserInvite_email_idx" ON "UserInvite" USING btree ("email");
CREATE INDEX IF NOT EXISTS "UserInvite_status_idx" ON "UserInvite" USING btree ("status");
DO $$ BEGIN ALTER TABLE "UserInvite" ADD CONSTRAINT "UserInvite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE restrict ON UPDATE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "DevTicket" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"type" text DEFAULT 'BUG' NOT NULL,
	"source" text DEFAULT 'INTERNAL' NOT NULL,
	"clientId" text,
	"clientName" text,
	"priority" text DEFAULT 'UNSET' NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"loomUrl" text,
	"reporterId" integer NOT NULL,
	"assigneeId" integer,
	"resolvedAt" timestamp(3),
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS "DevTicket_status_idx" ON "DevTicket" USING btree ("status");
CREATE INDEX IF NOT EXISTS "DevTicket_priority_idx" ON "DevTicket" USING btree ("priority");
CREATE INDEX IF NOT EXISTS "DevTicket_assigneeId_idx" ON "DevTicket" USING btree ("assigneeId");
CREATE INDEX IF NOT EXISTS "DevTicket_createdAt_idx" ON "DevTicket" USING btree ("createdAt" DESC);
DO $$ BEGIN ALTER TABLE "DevTicket" ADD CONSTRAINT "DevTicket_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE restrict ON UPDATE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "DevTicket" ADD CONSTRAINT "DevTicket_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE set null ON UPDATE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "DevTicketAttachment" (
	"id" text PRIMARY KEY NOT NULL,
	"ticketId" text NOT NULL,
	"r2Key" text NOT NULL,
	"fileName" text NOT NULL,
	"mimeType" text,
	"size" integer,
	"uploadedById" integer NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS "DevTicketAttachment_ticketId_idx" ON "DevTicketAttachment" USING btree ("ticketId");
DO $$ BEGIN ALTER TABLE "DevTicketAttachment" ADD CONSTRAINT "DevTicketAttachment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "DevTicket"("id") ON DELETE cascade ON UPDATE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "DevTicketAttachment" ADD CONSTRAINT "DevTicketAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE restrict ON UPDATE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "DevTicketComment" (
	"id" text PRIMARY KEY NOT NULL,
	"ticketId" text NOT NULL,
	"authorId" integer NOT NULL,
	"message" text NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS "DevTicketComment_ticketId_idx" ON "DevTicketComment" USING btree ("ticketId");
DO $$ BEGIN ALTER TABLE "DevTicketComment" ADD CONSTRAINT "DevTicketComment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "DevTicket"("id") ON DELETE cascade ON UPDATE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "DevTicketComment" ADD CONSTRAINT "DevTicketComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE restrict ON UPDATE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
