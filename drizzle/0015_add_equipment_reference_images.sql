-- Equipment reference photos. The column was added to src/lib/db/schema.ts
-- without a migration, so databases created from earlier migrations don't have
-- it — every insert/select on "Equipment" then fails with
-- "column referenceImageUrls does not exist". Safe to run more than once.
ALTER TABLE "Equipment" ADD COLUMN IF NOT EXISTS "referenceImageUrls" text[];
