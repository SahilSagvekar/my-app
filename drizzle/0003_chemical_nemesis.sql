CREATE TYPE "public"."FileDeletionRequestStatus" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."LogEntryStatus" AS ENUM('PLANNED', 'COMPLETED');--> statement-breakpoint
CREATE TYPE "public"."LogEntryType" AS ENUM('CALL', 'MEETING', 'ANALYTICS_REVIEW');--> statement-breakpoint
CREATE TYPE "public"."RawFootageFolderCode" AS ENUM('SF', 'LF');--> statement-breakpoint
CREATE TABLE "Equipment" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text,
	"notes" text,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdById" integer,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "FileDeletionRequest" (
	"id" text PRIMARY KEY NOT NULL,
	"fileId" text NOT NULL,
	"taskId" text NOT NULL,
	"requestedBy" integer NOT NULL,
	"reason" text,
	"status" "FileDeletionRequestStatus" DEFAULT 'PENDING' NOT NULL,
	"reviewedBy" integer,
	"reviewedAt" timestamp(3),
	"batchId" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "LogEntry" (
	"id" text PRIMARY KEY NOT NULL,
	"clientId" text NOT NULL,
	"type" "LogEntryType" NOT NULL,
	"title" text,
	"date" timestamp(3) NOT NULL,
	"location" text,
	"attendees" text[],
	"plannedMinutes" integer,
	"actualMinutes" integer,
	"status" "LogEntryStatus" DEFAULT 'PLANNED' NOT NULL,
	"noteLabel" text,
	"noteBody" text,
	"reportFileUrl" text,
	"reportFileName" text,
	"createdBy" integer,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "MediaPreview" (
	"id" text PRIMARY KEY NOT NULL,
	"s3Key" text NOT NULL,
	"fileId" text,
	"taskId" text,
	"previewS3Key" text,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"width" integer,
	"height" integer,
	"durationSeconds" double precision,
	"frameTimestampSeconds" double precision,
	"sourceEtag" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"errorMessage" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "MonthlyPaymentLedger" (
	"id" text PRIMARY KEY NOT NULL,
	"clientId" text NOT NULL,
	"month" text NOT NULL,
	"totalPaidCents" integer DEFAULT 0 NOT NULL,
	"paymentCount" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "MonthlyShootGeneration" (
	"id" text PRIMARY KEY NOT NULL,
	"clientId" text NOT NULL,
	"month" text NOT NULL,
	"shootsCreated" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "PortfolioChannel" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"channelUrl" text NOT NULL,
	"avatarUrl" text,
	"followerCount" text DEFAULT '' NOT NULL,
	"category" text NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "PortfolioImage" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"imageUrl" text NOT NULL,
	"thumbnailUrl" text,
	"category" text DEFAULT 'photography' NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "PortfolioUiSetting" (
	"id" text PRIMARY KEY NOT NULL,
	"howItWorksVisible" boolean DEFAULT true NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "RawFootageFolder" (
	"id" text PRIMARY KEY NOT NULL,
	"clientId" text NOT NULL,
	"monthFolder" text NOT NULL,
	"code" "RawFootageFolderCode" NOT NULL,
	"number" integer NOT NULL,
	"folderPath" text NOT NULL,
	"taskId" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ScriptShootLink" (
	"id" text PRIMARY KEY NOT NULL,
	"sourceShootTaskId" text NOT NULL,
	"scriptId" text NOT NULL,
	"targetShootTaskId" text NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "TechFeeFailure" (
	"id" text PRIMARY KEY NOT NULL,
	"stripeCustomerId" text NOT NULL,
	"chargeId" text NOT NULL,
	"sourceDescription" text NOT NULL,
	"attempts" integer DEFAULT 1 NOT NULL,
	"lastError" text,
	"resolved" boolean DEFAULT false NOT NULL,
	"resolvedAt" timestamp(3),
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Task" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "Task" ALTER COLUMN "status" SET DEFAULT 'PENDING'::text;--> statement-breakpoint
DROP TYPE "public"."TaskStatus";--> statement-breakpoint
CREATE TYPE "public"."TaskStatus" AS ENUM('PENDING', 'IN_PROGRESS', 'READY_FOR_QC', 'QC_IN_PROGRESS', 'COMPLETED', 'SCHEDULED', 'ON_HOLD', 'REJECTED_BY_QC', 'REJECTED_BY_CLIENT', 'CLIENT_REVIEW', 'VIDEOGRAPHER_ASSIGNED', 'POSTED', 'HIDDEN');--> statement-breakpoint
ALTER TABLE "Task" ALTER COLUMN "status" SET DEFAULT 'PENDING'::"public"."TaskStatus";--> statement-breakpoint
ALTER TABLE "Task" ALTER COLUMN "status" SET DATA TYPE "public"."TaskStatus" USING "status"::"public"."TaskStatus";--> statement-breakpoint
ALTER TABLE "User" ALTER COLUMN "roles" SET DATA TYPE "public"."Role"[] USING "roles"::"public"."Role"[];--> statement-breakpoint
ALTER TABLE "User" ALTER COLUMN "roles" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "QCRejectionReason" ALTER COLUMN "taskIds" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "UserTwoFactorAuth" ALTER COLUMN "backupCodes" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "SocialLogin" ALTER COLUMN "allowedRoles" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "SocialLogin" ALTER COLUMN "allowedUserIds" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "Notification" ALTER COLUMN "channel" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "Client" ALTER COLUMN "emails" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "Client" ALTER COLUMN "phones" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "Client" ALTER COLUMN "clientReviewDeliverableTypes" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "Client" ALTER COLUMN "templateHashtags" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "Task" ADD COLUMN "shootScriptRef" text;--> statement-breakpoint
ALTER TABLE "Task" ADD COLUMN "clientReviewStartedAt" timestamp(3);--> statement-breakpoint
ALTER TABLE "Task" ADD COLUMN "lastReminderSentAt" timestamp(3);--> statement-breakpoint
ALTER TABLE "ShootDetail" ADD COLUMN "hostName" text;--> statement-breakpoint
ALTER TABLE "ShootDetail" ADD COLUMN "equipmentIds" text[];--> statement-breakpoint
ALTER TABLE "ShootDetail" ADD COLUMN "equipmentReturnedAt" timestamp(3);--> statement-breakpoint
ALTER TABLE "ShootDetail" ADD COLUMN "equipmentReturnedPhotoUrl" text;--> statement-breakpoint
ALTER TABLE "ShootDetail" ADD COLUMN "equipmentReturnedPhotoUrls" text[];--> statement-breakpoint
ALTER TABLE "ShootDetail" ADD COLUMN "equipmentReturnedBy" integer;--> statement-breakpoint
ALTER TABLE "ShootDetail" ADD COLUMN "scriptContent" text;--> statement-breakpoint
ALTER TABLE "ShootDetail" ADD COLUMN "scriptStatus" text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "ShootDetail" ADD COLUMN "scriptSentAt" timestamp(3);--> statement-breakpoint
ALTER TABLE "ShootDetail" ADD COLUMN "scriptSentBy" integer;--> statement-breakpoint
ALTER TABLE "ShootDetail" ADD COLUMN "scriptLastEditedAt" timestamp(3);--> statement-breakpoint
ALTER TABLE "ShootDetail" ADD COLUMN "scriptLastEditedBy" integer;--> statement-breakpoint
ALTER TABLE "Client" ADD COLUMN "shootDaysPerMonth" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "LogEntry" ADD CONSTRAINT "LogEntry_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "LogEntry" ADD CONSTRAINT "LogEntry_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "MonthlyPaymentLedger" ADD CONSTRAINT "MonthlyPaymentLedger_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "MonthlyShootGeneration" ADD CONSTRAINT "MonthlyShootGeneration_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "RawFootageFolder" ADD CONSTRAINT "RawFootageFolder_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "RawFootageFolder" ADD CONSTRAINT "RawFootageFolder_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "public"."Task"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ScriptShootLink" ADD CONSTRAINT "ScriptShootLink_sourceShootTaskId_fkey" FOREIGN KEY ("sourceShootTaskId") REFERENCES "public"."Task"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ScriptShootLink" ADD CONSTRAINT "ScriptShootLink_targetShootTaskId_fkey" FOREIGN KEY ("targetShootTaskId") REFERENCES "public"."Task"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "FileDeletionRequest_taskId_idx" ON "FileDeletionRequest" USING btree ("taskId" text_ops);--> statement-breakpoint
CREATE INDEX "FileDeletionRequest_fileId_idx" ON "FileDeletionRequest" USING btree ("fileId" text_ops);--> statement-breakpoint
CREATE INDEX "FileDeletionRequest_status_idx" ON "FileDeletionRequest" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "FileDeletionRequest_batchId_idx" ON "FileDeletionRequest" USING btree ("batchId" text_ops);--> statement-breakpoint
CREATE INDEX "FileDeletionRequest_requestedBy_idx" ON "FileDeletionRequest" USING btree ("requestedBy" int4_ops);--> statement-breakpoint
CREATE INDEX "LogEntry_clientId_idx" ON "LogEntry" USING btree ("clientId" text_ops);--> statement-breakpoint
CREATE INDEX "LogEntry_clientId_date_idx" ON "LogEntry" USING btree ("clientId" text_ops,"date" timestamp_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "MediaPreview_s3Key_key" ON "MediaPreview" USING btree ("s3Key" text_ops);--> statement-breakpoint
CREATE INDEX "MediaPreview_previewS3Key_idx" ON "MediaPreview" USING btree ("previewS3Key" text_ops);--> statement-breakpoint
CREATE INDEX "MediaPreview_fileId_idx" ON "MediaPreview" USING btree ("fileId" text_ops);--> statement-breakpoint
CREATE INDEX "MediaPreview_taskId_idx" ON "MediaPreview" USING btree ("taskId" text_ops);--> statement-breakpoint
CREATE INDEX "MediaPreview_status_idx" ON "MediaPreview" USING btree ("status" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "MonthlyPaymentLedger_clientId_month_key" ON "MonthlyPaymentLedger" USING btree ("clientId" text_ops,"month" text_ops);--> statement-breakpoint
CREATE INDEX "MonthlyPaymentLedger_month_idx" ON "MonthlyPaymentLedger" USING btree ("month" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "MonthlyShootGeneration_clientId_month_key" ON "MonthlyShootGeneration" USING btree ("clientId" text_ops,"month" text_ops);--> statement-breakpoint
CREATE INDEX "PortfolioChannel_category_idx" ON "PortfolioChannel" USING btree ("category" text_ops);--> statement-breakpoint
CREATE INDEX "PortfolioChannel_category_order_idx" ON "PortfolioChannel" USING btree ("category" text_ops,"order" int4_ops);--> statement-breakpoint
CREATE INDEX "PortfolioChannel_isActive_idx" ON "PortfolioChannel" USING btree ("isActive" bool_ops);--> statement-breakpoint
CREATE INDEX "PortfolioImage_category_idx" ON "PortfolioImage" USING btree ("category" text_ops);--> statement-breakpoint
CREATE INDEX "PortfolioImage_category_order_idx" ON "PortfolioImage" USING btree ("category" int4_ops,"order" int4_ops);--> statement-breakpoint
CREATE INDEX "PortfolioImage_isActive_idx" ON "PortfolioImage" USING btree ("isActive" bool_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "RawFootageFolder_client_month_code_number_key" ON "RawFootageFolder" USING btree ("clientId" text_ops,"monthFolder" text_ops,"code" text_ops,"number" int4_ops);--> statement-breakpoint
CREATE INDEX "RawFootageFolder_taskId_idx" ON "RawFootageFolder" USING btree ("taskId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "ScriptShootLink_scriptId_target_key" ON "ScriptShootLink" USING btree ("scriptId" text_ops,"targetShootTaskId" text_ops);--> statement-breakpoint
CREATE INDEX "ScriptShootLink_targetShootTaskId_idx" ON "ScriptShootLink" USING btree ("targetShootTaskId" text_ops);--> statement-breakpoint
CREATE INDEX "TechFeeFailure_resolved_idx" ON "TechFeeFailure" USING btree ("resolved" bool_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "TechFeeFailure_chargeId_key" ON "TechFeeFailure" USING btree ("chargeId" text_ops);--> statement-breakpoint
CREATE INDEX "Task_clientReviewStartedAt_idx" ON "Task" USING btree ("clientReviewStartedAt" timestamp_ops);