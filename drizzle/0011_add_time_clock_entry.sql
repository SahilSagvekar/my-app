-- Daily Start/Stop time clock. One row per user per EST calendar day.
-- Idempotent: table may already exist if it was pushed via Prisma earlier.

CREATE TABLE IF NOT EXISTS "TimeClockEntry" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"workDate" text NOT NULL,
	"clockInAt" timestamp(3) NOT NULL,
	"clockOutAt" timestamp(3),
	"autoClosedOut" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "TimeClockEntry_userId_workDate_key"
	ON "TimeClockEntry" USING btree ("userId", "workDate");
CREATE INDEX IF NOT EXISTS "TimeClockEntry_userId_idx"
	ON "TimeClockEntry" USING btree ("userId");
CREATE INDEX IF NOT EXISTS "TimeClockEntry_workDate_idx"
	ON "TimeClockEntry" USING btree ("workDate");

DO $$ BEGIN
	ALTER TABLE "TimeClockEntry"
		ADD CONSTRAINT "TimeClockEntry_userId_fkey"
		FOREIGN KEY ("userId") REFERENCES "User"("id")
		ON DELETE cascade ON UPDATE cascade;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;
