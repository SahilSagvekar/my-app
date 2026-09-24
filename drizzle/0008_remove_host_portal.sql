-- Reverts 0008_add_host_portal.sql (which was already applied to the live
-- database). Product decision: the Host Portal feature is being removed
-- entirely, not just reworked.

DROP TABLE IF EXISTS "HostDocument";
--> statement-breakpoint
DROP TABLE IF EXISTS "HostPayment";
--> statement-breakpoint
DROP TABLE IF EXISTS "HostPayoutProfile";
--> statement-breakpoint

DROP INDEX IF EXISTS "ShootDetail_hostId_idx";
--> statement-breakpoint
ALTER TABLE "ShootDetail" DROP CONSTRAINT IF EXISTS "ShootDetail_hostId_fkey";
--> statement-breakpoint
ALTER TABLE "ShootDetail" DROP COLUMN IF EXISTS "hostId";
--> statement-breakpoint
ALTER TABLE "ShootDetail" DROP COLUMN IF EXISTS "hostRole";
--> statement-breakpoint
ALTER TABLE "ShootDetail" DROP COLUMN IF EXISTS "hostWardrobe";
--> statement-breakpoint
ALTER TABLE "ShootDetail" DROP COLUMN IF EXISTS "hostRate";
--> statement-breakpoint

-- NOT reverted here on purpose: the 'host' value added to the "Role" enum.
--
-- Postgres has no `ALTER TYPE ... DROP VALUE`. Removing a value requires
-- recreating the whole enum type: create a new type without it, repoint
-- every column that uses "Role" to the new type, drop the old type, rename
-- the new one in. That's not a one-column job here — "Role" is used by
-- "User"."role", "User"."roles" (array), "RolePermission"."role",
-- "Guideline"."role", "TrainingCourse"."role", "TrainingVideo"."role", and
-- "TrainingDocument"."role" (two of those have indexes on the column too).
-- Doing that blind, from a migration that's never been run against a copy
-- of the real data, is a materially riskier change than anything else in
-- this file for a value that does no harm just sitting unused in the enum.
--
-- If you want it gone anyway, run this manually after confirming no row
-- anywhere actually uses it:
--
--   SELECT 'User' t, id FROM "User" WHERE role = 'host' OR 'host' = ANY(roles)
--   UNION ALL SELECT 'RolePermission', id FROM "RolePermission" WHERE role = 'host'
--   UNION ALL SELECT 'Guideline', id FROM "Guideline" WHERE role = 'host'
--   UNION ALL SELECT 'TrainingCourse', id FROM "TrainingCourse" WHERE role = 'host'
--   UNION ALL SELECT 'TrainingVideo', id FROM "TrainingVideo" WHERE role = 'host'
--   UNION ALL SELECT 'TrainingDocument', id FROM "TrainingDocument" WHERE role = 'host';
--
-- -- only if that returns zero rows:
-- ALTER TYPE "Role" RENAME TO "Role_old";
-- CREATE TYPE "Role" AS ENUM ('admin', 'manager', 'editor', 'videographer', 'scheduler', 'client', 'qc', 'sales', 'sales_manager');
-- ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role" USING "role"::text::"Role";
-- ALTER TABLE "User" ALTER COLUMN "roles" TYPE "Role"[] USING "roles"::text[]::"Role"[];
-- ALTER TABLE "RolePermission" ALTER COLUMN "role" TYPE "Role" USING "role"::text::"Role";
-- ALTER TABLE "Guideline" ALTER COLUMN "role" TYPE "Role" USING "role"::text::"Role";
-- ALTER TABLE "TrainingCourse" ALTER COLUMN "role" TYPE "Role" USING "role"::text::"Role";
-- ALTER TABLE "TrainingVideo" ALTER COLUMN "role" TYPE "Role" USING "role"::text::"Role";
-- ALTER TABLE "TrainingDocument" ALTER COLUMN "role" TYPE "Role" USING "role"::text::"Role";
-- DROP TYPE "Role_old";
