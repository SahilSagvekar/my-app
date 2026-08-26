-- Split TaskStatus.REJECTED into REJECTED_BY_QC and REJECTED_BY_CLIENT.
-- Existing REJECTED rows become REJECTED_BY_QC.
-- Postgres cannot drop an enum value in-place, so we recreate the type.

ALTER TYPE "TaskStatus" RENAME TO "TaskStatus_old";

CREATE TYPE "TaskStatus" AS ENUM (
  'PENDING',
  'IN_PROGRESS',
  'READY_FOR_QC',
  'QC_IN_PROGRESS',
  'COMPLETED',
  'SCHEDULED',
  'ON_HOLD',
  'REJECTED_BY_QC',
  'REJECTED_BY_CLIENT',
  'CLIENT_REVIEW',
  'VIDEOGRAPHER_ASSIGNED',
  'POSTED',
  'HIDDEN'
);

ALTER TABLE "Task"
  ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "Task"
  ALTER COLUMN "status" TYPE "TaskStatus"
  USING (
    CASE
      WHEN "status"::text = 'REJECTED' THEN 'REJECTED_BY_QC'::"TaskStatus"
      ELSE "status"::text::"TaskStatus"
    END
  );

ALTER TABLE "Task"
  ALTER COLUMN "status" SET DEFAULT 'PENDING'::"TaskStatus";

DROP TYPE "TaskStatus_old";
