-- Host Portal, phase 1: a `host` role plus a real host link on shoots.
-- (Host payments / paperwork tables come in later phases.)
--
-- Notes:
--  * ALTER TYPE ... ADD VALUE cannot be undone in Postgres (see the note in
--    0008_remove_host_portal.sql), and the new value cannot be USED in the same
--    transaction that adds it. Run this file on its own; it only adds the value.
--  * "hostName" (free text, already on ShootDetail) is kept for shoots booked
--    before hosts had accounts. "hostId" is the real link. One host per shoot.

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
ALTER TABLE "ShootDetail" ADD COLUMN IF NOT EXISTS "hostNotes" text;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "ShootDetail" ADD CONSTRAINT "ShootDetail_hostId_fkey"
    FOREIGN KEY ("hostId") REFERENCES "User"("id") ON UPDATE CASCADE ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "ShootDetail_hostId_idx" ON "ShootDetail" USING btree ("hostId");
