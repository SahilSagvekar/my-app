-- Host Portal (see design_handoff_host_portal/README.md). A third portal,
-- sibling to the Videographer Portal, for booked hosts/talent to see their
-- own shoots, payments, and paperwork. One host per shoot.

ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'host';
--> statement-breakpoint

ALTER TABLE "ShootDetail" ADD COLUMN IF NOT EXISTS "hostId" integer;
--> statement-breakpoint
ALTER TABLE "ShootDetail" ADD COLUMN IF NOT EXISTS "hostRole" text;
--> statement-breakpoint
ALTER TABLE "ShootDetail" ADD COLUMN IF NOT EXISTS "hostWardrobe" text;
--> statement-breakpoint
ALTER TABLE "ShootDetail" ADD COLUMN IF NOT EXISTS "hostRate" numeric(10, 2);
--> statement-breakpoint
ALTER TABLE "ShootDetail" ADD CONSTRAINT "ShootDetail_hostId_fkey"
  FOREIGN KEY ("hostId") REFERENCES "User"("id") ON UPDATE CASCADE ON DELETE SET NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ShootDetail_hostId_idx" ON "ShootDetail" USING btree ("hostId");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "HostPayoutProfile" (
  "id" text PRIMARY KEY NOT NULL,
  "userId" integer NOT NULL,
  "fullLegalName" text,
  "phone" text,
  "email" text,
  "mailingAddress" text,
  "payoutMethod" text,
  "payoutAccount" text,
  "standardRate" numeric(10, 2),
  "verificationStatus" text DEFAULT 'verified' NOT NULL,
  "pendingPayoutMethod" text,
  "pendingPayoutAccount" text,
  "createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "HostPayoutProfile_userId_key" ON "HostPayoutProfile" USING btree ("userId");
--> statement-breakpoint
ALTER TABLE "HostPayoutProfile" ADD CONSTRAINT "HostPayoutProfile_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON UPDATE CASCADE ON DELETE RESTRICT;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "HostPayment" (
  "id" text PRIMARY KEY NOT NULL,
  "hostUserId" integer NOT NULL,
  "shootDetailId" text,
  "label" text NOT NULL,
  "amount" numeric(12, 2) NOT NULL,
  "currency" text DEFAULT 'usd' NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "method" text,
  "scheduledDate" timestamp(3),
  "sentAt" timestamp(3),
  "source" text DEFAULT 'manual' NOT NULL,
  "externalRef" text,
  "createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "HostPayment_hostUserId_idx" ON "HostPayment" USING btree ("hostUserId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "HostPayment_status_idx" ON "HostPayment" USING btree ("status");
--> statement-breakpoint
ALTER TABLE "HostPayment" ADD CONSTRAINT "HostPayment_hostUserId_fkey"
  FOREIGN KEY ("hostUserId") REFERENCES "User"("id") ON UPDATE CASCADE ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "HostPayment" ADD CONSTRAINT "HostPayment_shootDetailId_fkey"
  FOREIGN KEY ("shootDetailId") REFERENCES "ShootDetail"("id") ON UPDATE CASCADE ON DELETE SET NULL;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "HostDocument" (
  "id" text PRIMARY KEY NOT NULL,
  "hostUserId" integer NOT NULL,
  "formType" text NOT NULL,
  "taxYear" integer DEFAULT 0 NOT NULL,
  "status" text DEFAULT 'missing' NOT NULL,
  "fileS3Key" text,
  "fileName" text,
  "submittedAt" timestamp(3),
  "reviewedAt" timestamp(3),
  "reviewedBy" integer,
  "updatedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "HostDocument_hostUserId_formType_taxYear_key" ON "HostDocument" USING btree ("hostUserId", "formType", "taxYear");
--> statement-breakpoint
ALTER TABLE "HostDocument" ADD CONSTRAINT "HostDocument_hostUserId_fkey"
  FOREIGN KEY ("hostUserId") REFERENCES "User"("id") ON UPDATE CASCADE ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "HostDocument" ADD CONSTRAINT "HostDocument_reviewedBy_fkey"
  FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON UPDATE CASCADE ON DELETE SET NULL;
