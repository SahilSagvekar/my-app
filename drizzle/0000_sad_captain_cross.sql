-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TYPE "public"."BidStatus" AS ENUM('PENDING', 'ACCEPTED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."ContractStatus" AS ENUM('DRAFT', 'SENT', 'PARTIALLY_SIGNED', 'COMPLETED', 'CANCELLED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."EmployeeStatus" AS ENUM('ACTIVE', 'INACTIVE', 'TERMINATED');--> statement-breakpoint
CREATE TYPE "public"."FeedbackCategory" AS ENUM('GENERAL', 'TECHNICAL', 'WORKFLOW', 'SUGGESTION', 'BUG_REPORT');--> statement-breakpoint
CREATE TYPE "public"."FeedbackPriority" AS ENUM('LOW', 'MEDIUM', 'HIGH');--> statement-breakpoint
CREATE TYPE "public"."FeedbackStatus" AS ENUM('PENDING', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED');--> statement-breakpoint
CREATE TYPE "public"."HiringCandidateStatus" AS ENUM('NEW', 'CONTACTED', 'TEST_SENT', 'TEST_SUBMITTED', 'IN_REVIEW', 'HIRED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."HiringTestTaskStatus" AS ENUM('PENDING', 'SENT', 'SUBMITTED', 'IN_REVIEW', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."InvoiceStatus" AS ENUM('DRAFT', 'PENDING', 'SENT', 'PAID', 'PARTIALLY_PAID', 'OVERDUE', 'CANCELED', 'REFUNDED');--> statement-breakpoint
CREATE TYPE "public"."JobStatus" AS ENUM('OPEN', 'ASSIGNED', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."LeaveStatus" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."PaymentStatus" AS ENUM('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELED', 'REFUNDED');--> statement-breakpoint
CREATE TYPE "public"."PayrollStatus" AS ENUM('PENDING', 'PAID');--> statement-breakpoint
CREATE TYPE "public"."PeriodType" AS ENUM('DAILY', 'WEEKLY', 'MONTHLY');--> statement-breakpoint
CREATE TYPE "public"."PortalAccessStatus" AS ENUM('ONBOARDING', 'CONTRACT_PENDING', 'PAYMENT_PENDING', 'ACTIVE', 'LOCKED', 'ADMIN_UNLOCKED');--> statement-breakpoint
CREATE TYPE "public"."PreClientStatus" AS ENUM('QUALIFIED', 'QUOTED', 'QUOTE_ACCEPTED', 'PROVISIONING', 'CONVERTED');--> statement-breakpoint
CREATE TYPE "public"."QuoteStatus" AS ENUM('DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."Role" AS ENUM('admin', 'manager', 'editor', 'videographer', 'scheduler', 'client', 'qc', 'sales', 'sales_manager');--> statement-breakpoint
CREATE TYPE "public"."SignerStatus" AS ENUM('PENDING', 'VIEWED', 'SIGNED', 'DECLINED');--> statement-breakpoint
CREATE TYPE "public"."SubscriptionStatus" AS ENUM('ACTIVE', 'PAST_DUE', 'CANCELED', 'UNPAID', 'TRIALING', 'PAUSED');--> statement-breakpoint
CREATE TYPE "public"."SyncStatus" AS ENUM('PENDING', 'SYNCING', 'COMPLETED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."TaskStatus" AS ENUM('PENDING', 'IN_PROGRESS', 'READY_FOR_QC', 'QC_IN_PROGRESS', 'COMPLETED', 'SCHEDULED', 'ON_HOLD', 'REJECTED', 'CLIENT_REVIEW', 'VIDEOGRAPHER_ASSIGNED', 'POSTED', 'HIDDEN');--> statement-breakpoint
CREATE TABLE "VerificationToken" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "MonthlyDeliverable" (
	"id" text PRIMARY KEY NOT NULL,
	"clientId" text NOT NULL,
	"type" text NOT NULL,
	"quantity" integer NOT NULL,
	"videosPerDay" integer NOT NULL,
	"postingSchedule" text NOT NULL,
	"postingDays" text[],
	"postingTimes" text[],
	"platforms" text[],
	"description" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"isTrial" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "BrandAsset" (
	"id" text PRIMARY KEY NOT NULL,
	"clientId" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"fileUrl" text NOT NULL,
	"fileName" text NOT NULL,
	"fileSize" text NOT NULL,
	"uploadedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"uploadedBy" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "MonthlyRun" (
	"id" text PRIMARY KEY NOT NULL,
	"clientId" text NOT NULL,
	"month" integer NOT NULL,
	"year" integer NOT NULL,
	"runAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Bonus" (
	"id" serial PRIMARY KEY NOT NULL,
	"employeeId" integer NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"addedBy" integer,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "NotificationPreference" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"channel" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Leave" (
	"id" serial PRIMARY KEY NOT NULL,
	"employeeId" integer NOT NULL,
	"startDate" timestamp(3) NOT NULL,
	"endDate" timestamp(3) NOT NULL,
	"reason" text,
	"status" "LeaveStatus" DEFAULT 'PENDING' NOT NULL,
	"numberOfDays" integer NOT NULL,
	"approvedBy" integer,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Account" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"type" text DEFAULT 'pending' NOT NULL,
	"provider" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text
);
--> statement-breakpoint
CREATE TABLE "Deduction" (
	"id" serial PRIMARY KEY NOT NULL,
	"employeeId" integer NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"leaveId" integer,
	"month" timestamp(3) NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Payroll" (
	"id" serial PRIMARY KEY NOT NULL,
	"employeeId" integer NOT NULL,
	"periodStart" timestamp(3) NOT NULL,
	"periodEnd" timestamp(3) NOT NULL,
	"baseSalary" numeric(12, 2) NOT NULL,
	"totalBonuses" numeric(12, 2) DEFAULT '0' NOT NULL,
	"totalDeductions" numeric(12, 2) DEFAULT '0' NOT NULL,
	"netPay" numeric(12, 2) NOT NULL,
	"status" "PayrollStatus" DEFAULT 'PENDING' NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"paidAt" timestamp(3),
	"hidden" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "_prisma_migrations" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"checksum" varchar(64) NOT NULL,
	"finished_at" timestamp with time zone,
	"migration_name" varchar(255) NOT NULL,
	"logs" text,
	"rolled_back_at" timestamp with time zone,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"applied_steps_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Session" (
	"id" text PRIMARY KEY NOT NULL,
	"sessionToken" text NOT NULL,
	"userId" integer NOT NULL,
	"expires" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "User" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"password" text,
	"image" text,
	"role" "Role",
	"hourlyRate" numeric(10, 2),
	"monthlyBaseHours" integer,
	"employeeStatus" "EmployeeStatus" DEFAULT 'ACTIVE',
	"joinedAt" timestamp(3),
	"worksOnSaturday" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"resetOTP" text,
	"resetOTPExpiry" timestamp(3),
	"hoursPerWeek" numeric(5, 2) DEFAULT '0',
	"phone" text,
	"monthlyRate" integer,
	"linkedClientId" text,
	"emailNotifications" boolean DEFAULT true NOT NULL,
	"slackNotifications" boolean DEFAULT false NOT NULL,
	"slackUserId" text,
	"loginOTP" text,
	"loginOTPExpiry" timestamp(3),
	"roles" "Role""[] DEFAULT '{"RAY"}'
);
--> statement-breakpoint
CREATE TABLE "AuditLog" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer,
	"action" text NOT NULL,
	"entity" text,
	"entityId" text,
	"details" text,
	"metadata" jsonb,
	"ipAddress" text,
	"userAgent" text,
	"timestamp" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"subject" text NOT NULL,
	"message" text NOT NULL,
	"category" text NOT NULL,
	"priority" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"senderId" integer NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "FeedbackResponse" (
	"id" text PRIMARY KEY NOT NULL,
	"message" text NOT NULL,
	"feedbackId" text NOT NULL,
	"senderId" integer NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "RecurringTask" (
	"id" text PRIMARY KEY NOT NULL,
	"clientId" text NOT NULL,
	"deliverableId" text NOT NULL,
	"templateTaskId" text,
	"nextRunDate" timestamp(3) NOT NULL,
	"lastRunDate" timestamp(3),
	"scheduleType" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"defaultAssignedTo" integer,
	"defaultQcSpecialist" integer,
	"defaultScheduler" integer,
	"defaultVideographer" integer
);
--> statement-breakpoint
CREATE TABLE "QCAchievement" (
	"id" text PRIMARY KEY NOT NULL,
	"qcSpecialistId" integer NOT NULL,
	"achievementType" text NOT NULL,
	"unlockedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"achievementData" jsonb
);
--> statement-breakpoint
CREATE TABLE "UserSecurityPin" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"pinHash" text NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"lastVerifiedAt" timestamp(3)
);
--> statement-breakpoint
CREATE TABLE "LoginAuditLog" (
	"id" text PRIMARY KEY NOT NULL,
	"action" text NOT NULL,
	"loginId" text,
	"userId" integer NOT NULL,
	"details" text,
	"ipAddress" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "QCAnalytics" (
	"id" text PRIMARY KEY NOT NULL,
	"qcSpecialistId" integer NOT NULL,
	"avgReviewTime" numeric(10, 2) NOT NULL,
	"approvalRate" numeric(10, 2) NOT NULL,
	"firstPassRate" numeric(10, 2) NOT NULL,
	"totalReviews" integer DEFAULT 0 NOT NULL,
	"approvedCount" integer DEFAULT 0 NOT NULL,
	"rejectedCount" integer DEFAULT 0 NOT NULL,
	"period" text DEFAULT 'month' NOT NULL,
	"startDate" timestamp(3) NOT NULL,
	"endDate" timestamp(3) NOT NULL,
	"calculatedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "QCRejectionReason" (
	"id" text PRIMARY KEY NOT NULL,
	"qcSpecialistId" integer NOT NULL,
	"reason" text NOT NULL,
	"caseCount" integer DEFAULT 1 NOT NULL,
	"taskIds" text[] DEFAULT '{"RAY"}',
	"firstOccurrence" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"lastOccurrence" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "QCMonthlyTrend" (
	"id" text PRIMARY KEY NOT NULL,
	"qcSpecialistId" integer NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"reviewCount" integer DEFAULT 0 NOT NULL,
	"approvedCount" integer DEFAULT 0 NOT NULL,
	"rejectedCount" integer DEFAULT 0 NOT NULL,
	"avgReviewTime" numeric(10, 2) NOT NULL,
	"approvalRate" numeric(10, 2) NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "TaskFeedback" (
	"id" text PRIMARY KEY NOT NULL,
	"taskId" text NOT NULL,
	"fileId" text,
	"folderType" text NOT NULL,
	"feedback" text NOT NULL,
	"status" text DEFAULT 'needs_revision' NOT NULL,
	"timestamp" text,
	"category" text,
	"createdBy" integer NOT NULL,
	"resolvedAt" timestamp(3),
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"acknowledgedAt" timestamp(3),
	"acknowledgedBy" integer
);
--> statement-breakpoint
CREATE TABLE "QCCategoryMetrics" (
	"id" text PRIMARY KEY NOT NULL,
	"qcSpecialistId" integer NOT NULL,
	"category" text NOT NULL,
	"reviewCount" integer DEFAULT 0 NOT NULL,
	"approvedCount" integer DEFAULT 0 NOT NULL,
	"rejectedCount" integer DEFAULT 0 NOT NULL,
	"approvalRate" numeric(10, 2) NOT NULL,
	"avgReviewTime" numeric(10, 2) NOT NULL,
	"period" text DEFAULT 'month' NOT NULL,
	"startDate" timestamp(3) NOT NULL,
	"endDate" timestamp(3) NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Task" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text,
	"description" text NOT NULL,
	"taskType" text,
	"status" "TaskStatus" DEFAULT 'PENDING',
	"dueDate" timestamp(3),
	"clientUserId" integer,
	"folderType" text,
	"assignedTo" integer NOT NULL,
	"qc_specialist" integer,
	"scheduler" integer,
	"videographer" integer,
	"createdBy" integer,
	"clientId" text,
	"monthlyDeliverableId" text,
	"driveFolderId" text,
	"attachments" jsonb,
	"driveLinks" text[],
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"priority" text,
	"taskCategory" text,
	"nextDestination" text,
	"clientReview" boolean DEFAULT false,
	"requiresClientReview" boolean DEFAULT false,
	"workflowStep" text,
	"feedback" text,
	"qcNotes" text,
	"qcResult" text,
	"route" text,
	"monthFolder" text,
	"outputFolderId" text,
	"deliverableType" text,
	"hasCovers" boolean DEFAULT false NOT NULL,
	"hasMainFile" boolean DEFAULT false NOT NULL,
	"hasMusicLicense" boolean DEFAULT false NOT NULL,
	"hasThumbnails" boolean DEFAULT false NOT NULL,
	"hasTiles" boolean DEFAULT false NOT NULL,
	"socialMediaLinks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"platform" text,
	"suggestedTitles" jsonb,
	"titlingError" text,
	"titlingStatus" text DEFAULT 'NONE' NOT NULL,
	"transcript" text,
	"transcriptSummary" text,
	"qcReviewedAt" timestamp(3),
	"qcReviewedBy" integer,
	"oneOffDeliverableId" text,
	"recurringMonth" text,
	"billedAt" timestamp(3),
	"invoiceId" text,
	"isTrial" boolean DEFAULT false NOT NULL,
	"extraSequence" integer,
	"isExtra" boolean DEFAULT false NOT NULL,
	"relatedTaskId" text,
	"titleSetByQC" boolean DEFAULT false NOT NULL,
	"postingTitle" text,
	"isSponsored" boolean DEFAULT false NOT NULL,
	"titleSetByClient" boolean DEFAULT false NOT NULL,
	"postingDescriptions" jsonb,
	"postingTags" jsonb,
	"postingTitles" jsonb,
	"textContent" text
);
--> statement-breakpoint
CREATE TABLE "UserTwoFactorAuth" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"totpSecret" text NOT NULL,
	"isEnabled" boolean DEFAULT false NOT NULL,
	"backupCodes" text[] DEFAULT '{"RAY"}',
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"lastVerifiedAt" timestamp(3)
);
--> statement-breakpoint
CREATE TABLE "ShareableReview" (
	"id" text PRIMARY KEY NOT NULL,
	"taskId" text NOT NULL,
	"shareToken" text NOT NULL,
	"createdBy" integer NOT NULL,
	"expiresAt" timestamp(3),
	"viewCount" integer DEFAULT 0 NOT NULL,
	"lastViewedAt" timestamp(3),
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "SocialLogin" (
	"id" text PRIMARY KEY NOT NULL,
	"clientId" text,
	"platform" text NOT NULL,
	"username" text NOT NULL,
	"encryptedPassword" text NOT NULL,
	"recoveryEmail" text,
	"recoveryPhone" text,
	"notes" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"updatedById" integer NOT NULL,
	"adminOnly" boolean DEFAULT false NOT NULL,
	"backupCodesLocation" text,
	"loginUrl" text,
	"passwordChangedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"allowedRoles" text[] DEFAULT '{"RAY"}',
	"allowedUserIds" integer[] DEFAULT '{RAY}',
	"accessRole" text
);
--> statement-breakpoint
CREATE TABLE "TitlingJob" (
	"id" text PRIMARY KEY NOT NULL,
	"taskId" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"assemblyId" text,
	"error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"startedAt" timestamp(3),
	"completedAt" timestamp(3),
	"videoFileId" text,
	"videoFileName" text,
	"videoDuration" integer
);
--> statement-breakpoint
CREATE TABLE "ActivityReport" (
	"id" text PRIMARY KEY NOT NULL,
	"fileName" text NOT NULL,
	"fileUrl" text,
	"reportDate" timestamp(3) NOT NULL,
	"generatedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"metadata" jsonb,
	"status" text DEFAULT 'completed' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ShareableFile" (
	"id" text PRIMARY KEY NOT NULL,
	"s3Key" text NOT NULL,
	"fileName" text NOT NULL,
	"fileSize" bigint,
	"mimeType" text,
	"shareToken" text NOT NULL,
	"createdBy" integer NOT NULL,
	"expiresAt" timestamp(3),
	"viewCount" integer DEFAULT 0 NOT NULL,
	"lastViewedAt" timestamp(3),
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Notification" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" integer,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"payload" jsonb,
	"channel" text[] DEFAULT '{"RAY"}',
	"delivered" boolean DEFAULT false NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "YouTubeSnapshot" (
	"id" text PRIMARY KEY NOT NULL,
	"channelId" text NOT NULL,
	"clientId" text NOT NULL,
	"subscriberCount" integer DEFAULT 0 NOT NULL,
	"views" bigint DEFAULT 0 NOT NULL,
	"watchTimeHours" double precision DEFAULT 0 NOT NULL,
	"estimatedRevenue" double precision,
	"likes" integer DEFAULT 0 NOT NULL,
	"comments" integer DEFAULT 0 NOT NULL,
	"shares" integer DEFAULT 0 NOT NULL,
	"impressions" bigint DEFAULT 0 NOT NULL,
	"impressionsCtr" double precision,
	"avgViewDuration" double precision,
	"subscribersGained" integer DEFAULT 0 NOT NULL,
	"subscribersLost" integer DEFAULT 0 NOT NULL,
	"geographyData" jsonb,
	"deviceData" jsonb,
	"periodStart" timestamp(3) NOT NULL,
	"periodEnd" timestamp(3) NOT NULL,
	"periodType" "PeriodType" DEFAULT 'DAILY' NOT NULL,
	"snapshotDate" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"dateRange" text DEFAULT '28d' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "YouTubeVideoStat" (
	"id" text PRIMARY KEY NOT NULL,
	"channelId" text NOT NULL,
	"videoId" text NOT NULL,
	"title" text NOT NULL,
	"publishedAt" timestamp(3) NOT NULL,
	"thumbnailUrl" text,
	"duration" integer,
	"views" bigint DEFAULT 0 NOT NULL,
	"likes" integer DEFAULT 0 NOT NULL,
	"comments" integer DEFAULT 0 NOT NULL,
	"shares" integer DEFAULT 0 NOT NULL,
	"watchTimeHours" double precision DEFAULT 0 NOT NULL,
	"avgViewDuration" double precision,
	"estimatedRevenue" double precision,
	"lastUpdated" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "YouTubeChannel" (
	"id" text PRIMARY KEY NOT NULL,
	"clientId" text NOT NULL,
	"channelId" text NOT NULL,
	"channelTitle" text,
	"channelAvatar" text,
	"accessToken" text NOT NULL,
	"refreshToken" text NOT NULL,
	"tokenExpiry" timestamp(3) NOT NULL,
	"scope" text,
	"subscriberCount" integer DEFAULT 0 NOT NULL,
	"totalViews" bigint DEFAULT 0 NOT NULL,
	"totalVideos" integer DEFAULT 0 NOT NULL,
	"lastSyncedAt" timestamp(3),
	"syncStatus" "SyncStatus" DEFAULT 'PENDING' NOT NULL,
	"syncError" text,
	"isActive" boolean DEFAULT true NOT NULL,
	"connectedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ShootDetail" (
	"id" text PRIMARY KEY NOT NULL,
	"taskId" text NOT NULL,
	"location" text,
	"shootDate" timestamp(3),
	"referenceLinks" text[],
	"referenceFiles" jsonb,
	"camera" text,
	"quality" text,
	"frameRate" text,
	"lighting" text,
	"exclusions" text,
	"videographerNotes" text,
	"videographerId" integer,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "MetaAccount" (
	"id" text PRIMARY KEY NOT NULL,
	"clientId" text NOT NULL,
	"instagramId" text,
	"facebookPageId" text,
	"username" text,
	"profilePicture" text,
	"accessToken" text NOT NULL,
	"tokenExpiry" timestamp(3) NOT NULL,
	"followerCount" integer DEFAULT 0 NOT NULL,
	"followingCount" integer DEFAULT 0 NOT NULL,
	"mediaCount" integer DEFAULT 0 NOT NULL,
	"lastSyncedAt" timestamp(3),
	"syncStatus" "SyncStatus" DEFAULT 'PENDING' NOT NULL,
	"syncError" text,
	"isActive" boolean DEFAULT true NOT NULL,
	"connectedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "MetaSnapshot" (
	"id" text PRIMARY KEY NOT NULL,
	"metaAccountId" text NOT NULL,
	"clientId" text NOT NULL,
	"impressions" bigint DEFAULT 0 NOT NULL,
	"reach" bigint DEFAULT 0 NOT NULL,
	"profileViews" integer DEFAULT 0 NOT NULL,
	"websiteClicks" integer DEFAULT 0 NOT NULL,
	"followerCount" integer DEFAULT 0 NOT NULL,
	"followersGained" integer DEFAULT 0 NOT NULL,
	"engagement" integer DEFAULT 0 NOT NULL,
	"topPosts" jsonb,
	"demographics" jsonb,
	"periodStart" timestamp(3) NOT NULL,
	"periodEnd" timestamp(3) NOT NULL,
	"dateRange" text DEFAULT '28d' NOT NULL,
	"snapshotDate" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ClientRevenue" (
	"id" text PRIMARY KEY NOT NULL,
	"clientId" text NOT NULL,
	"platform" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"period" timestamp(3) NOT NULL,
	"source" text NOT NULL,
	"isAutomatic" boolean DEFAULT false NOT NULL,
	"notes" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "RolePermission" (
	"id" text PRIMARY KEY NOT NULL,
	"role" "Role" NOT NULL,
	"navigationItems" jsonb NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Job" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"location" text,
	"startDate" timestamp(3) NOT NULL,
	"endDate" timestamp(3),
	"equipment" text,
	"camera" text,
	"quality" text,
	"frameRate" text,
	"lighting" text,
	"exclusions" text,
	"referenceLinks" text[],
	"budget" numeric(10, 2),
	"status" "JobStatus" DEFAULT 'OPEN' NOT NULL,
	"createdById" integer NOT NULL,
	"assignedToId" integer,
	"clientId" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Bid" (
	"id" text PRIMARY KEY NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"note" text,
	"status" "BidStatus" DEFAULT 'PENDING' NOT NULL,
	"jobId" text NOT NULL,
	"userId" integer NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "SlackConfig" (
	"id" text PRIMARY KEY NOT NULL,
	"webhookUrl" text NOT NULL,
	"channelName" text,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Guideline" (
	"id" text PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"role" "Role",
	"clientId" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "EditorClientPermission" (
	"id" text PRIMARY KEY NOT NULL,
	"editorId" integer NOT NULL,
	"clientId" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "File" (
	"id" text PRIMARY KEY NOT NULL,
	"taskId" text NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"mimeType" text,
	"size" bigint NOT NULL,
	"uploadedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"uploadedBy" integer,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"folderType" text,
	"isActive" boolean DEFAULT true NOT NULL,
	"replacedAt" timestamp(3),
	"replacedBy" text,
	"revisionNote" text,
	"s3Key" text,
	"version" integer DEFAULT 1 NOT NULL,
	"codec" text,
	"archivedToNas" boolean DEFAULT false NOT NULL,
	"nasArchivedAt" timestamp(3),
	"nasPath" text,
	"proxyUrl" text,
	"optimizationError" text,
	"optimizationStatus" text DEFAULT 'NONE' NOT NULL,
	"reviewDriveUrl" text,
	"deletedFromCloud" boolean DEFAULT false NOT NULL,
	"deletedFromCloudAt" timestamp(3),
	"youtubeUploadedAt" timestamp(3),
	"youtubeVideoId" text
);
--> statement-breakpoint
CREATE TABLE "TrainingCourse" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"role" "Role" NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "TrainingVideo" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"videoUrl" text NOT NULL,
	"role" "Role" NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"courseId" text
);
--> statement-breakpoint
CREATE TABLE "PortfolioSubcategory" (
	"id" text PRIMARY KEY NOT NULL,
	"categoryId" text NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"iconName" text DEFAULT 'Video' NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "SalesDashboardColumn" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"name" text NOT NULL,
	"label" text NOT NULL,
	"type" text NOT NULL,
	"width" text DEFAULT 'w-[150px]',
	"order" integer DEFAULT 0 NOT NULL,
	"isVisible" boolean DEFAULT true NOT NULL,
	"isCustom" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "PortfolioLead" (
	"id" text PRIMARY KEY NOT NULL,
	"firstName" text NOT NULL,
	"lastName" text NOT NULL,
	"phone" text NOT NULL,
	"email" text NOT NULL,
	"serviceNeeded" text NOT NULL,
	"ipAddress" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "PortfolioVideo" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"videoUrl" text NOT NULL,
	"thumbnailUrl" text,
	"category" text NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "PortfolioCategory" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"iconName" text DEFAULT 'Film' NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "SocialPost" (
	"id" text PRIMARY KEY NOT NULL,
	"socialAccountId" text NOT NULL,
	"platformPostId" text NOT NULL,
	"postType" text NOT NULL,
	"title" text,
	"description" text,
	"thumbnailUrl" text,
	"postUrl" text NOT NULL,
	"publishedAt" timestamp(3) NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"likes" integer DEFAULT 0 NOT NULL,
	"comments" integer DEFAULT 0 NOT NULL,
	"shares" integer DEFAULT 0 NOT NULL,
	"saves" integer,
	"watchTime" integer,
	"engagementRate" double precision,
	"taskId" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "SocialAnalytics" (
	"id" text PRIMARY KEY NOT NULL,
	"socialAccountId" text NOT NULL,
	"date" date NOT NULL,
	"followers" integer DEFAULT 0 NOT NULL,
	"followersGained" integer DEFAULT 0 NOT NULL,
	"followersLost" integer DEFAULT 0 NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"likes" integer DEFAULT 0 NOT NULL,
	"comments" integer DEFAULT 0 NOT NULL,
	"shares" integer DEFAULT 0 NOT NULL,
	"impressions" integer,
	"reach" integer,
	"engagementRate" double precision,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ContractTemplate" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"s3Key" text NOT NULL,
	"fileName" text NOT NULL,
	"fileSize" bigint NOT NULL,
	"createdById" integer NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ContractAuditLog" (
	"id" text PRIMARY KEY NOT NULL,
	"contractId" text NOT NULL,
	"action" text NOT NULL,
	"performedBy" text,
	"ipAddress" text,
	"userAgent" text,
	"details" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "AffiliateCommission" (
	"id" text PRIMARY KEY NOT NULL,
	"salesUserId" integer NOT NULL,
	"leadId" text NOT NULL,
	"clientName" text DEFAULT '' NOT NULL,
	"dealValue" numeric(12, 2) NOT NULL,
	"commissionRate" numeric(5, 4) DEFAULT '0.15' NOT NULL,
	"commissionAmt" numeric(12, 2) NOT NULL,
	"month" timestamp(3) NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"paidAt" timestamp(3),
	"approvedAt" timestamp(3),
	"approvedBy" integer,
	"notes" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"holdUntil" timestamp(3),
	"payoutId" text
);
--> statement-breakpoint
CREATE TABLE "SocialAccount" (
	"id" text PRIMARY KEY NOT NULL,
	"clientId" text NOT NULL,
	"platform" text NOT NULL,
	"platformId" text NOT NULL,
	"platformName" text NOT NULL,
	"accessToken" text NOT NULL,
	"refreshToken" text,
	"tokenExpiry" timestamp(3),
	"profileUrl" text,
	"profileImage" text,
	"followerCount" integer DEFAULT 0 NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"lastSyncAt" timestamp(3),
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ContractSigner" (
	"id" text PRIMARY KEY NOT NULL,
	"contractId" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'signer' NOT NULL,
	"status" "SignerStatus" DEFAULT 'PENDING' NOT NULL,
	"signToken" text NOT NULL,
	"signedAt" timestamp(3),
	"viewedAt" timestamp(3),
	"declinedAt" timestamp(3),
	"declineReason" text,
	"signatureS3Key" text,
	"signatureType" text,
	"order" integer DEFAULT 0 NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"isVariableSigner" boolean DEFAULT false NOT NULL,
	"smsVerified" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "OneOffDeliverable" (
	"id" text PRIMARY KEY NOT NULL,
	"clientId" text NOT NULL,
	"type" text NOT NULL,
	"quantity" integer NOT NULL,
	"videosPerDay" integer NOT NULL,
	"postingSchedule" text NOT NULL,
	"postingDays" text[],
	"postingTimes" text[],
	"platforms" text[],
	"description" text,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"billedAt" timestamp(3),
	"invoiceId" text,
	"unitPrice" integer
);
--> statement-breakpoint
CREATE TABLE "PaymentMethod" (
	"id" text PRIMARY KEY NOT NULL,
	"stripeCustomerId" text NOT NULL,
	"stripePaymentMethodId" text NOT NULL,
	"type" text NOT NULL,
	"isDefault" boolean DEFAULT false NOT NULL,
	"cardBrand" text,
	"cardLast4" text,
	"cardExpMonth" integer,
	"cardExpYear" integer,
	"bankName" text,
	"bankLast4" text,
	"bankAccountType" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Subscription" (
	"id" text PRIMARY KEY NOT NULL,
	"stripeCustomerId" text NOT NULL,
	"stripeSubscriptionId" text NOT NULL,
	"stripePriceId" text NOT NULL,
	"status" "SubscriptionStatus" DEFAULT 'ACTIVE' NOT NULL,
	"currentPeriodStart" timestamp(3) NOT NULL,
	"currentPeriodEnd" timestamp(3) NOT NULL,
	"cancelAtPeriodEnd" boolean DEFAULT false NOT NULL,
	"canceledAt" timestamp(3),
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"interval" text DEFAULT 'month' NOT NULL,
	"metadata" jsonb,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Payment" (
	"id" text PRIMARY KEY NOT NULL,
	"invoiceId" text NOT NULL,
	"stripePaymentIntentId" text,
	"stripeChargeId" text,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"status" "PaymentStatus" DEFAULT 'PENDING' NOT NULL,
	"paymentMethod" text,
	"failureReason" text,
	"receiptUrl" text,
	"metadata" jsonb,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "StripeCustomer" (
	"id" text PRIMARY KEY NOT NULL,
	"clientId" text NOT NULL,
	"stripeCustomerId" text NOT NULL,
	"defaultPaymentMethod" text,
	"currency" text DEFAULT 'usd' NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "BillingPlan" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"stripePriceId" text NOT NULL,
	"stripeProductId" text NOT NULL,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"interval" text DEFAULT 'month' NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"features" jsonb,
	"metadata" jsonb,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Invoice" (
	"id" text PRIMARY KEY NOT NULL,
	"stripeCustomerId" text NOT NULL,
	"stripeInvoiceId" text,
	"invoiceNumber" text NOT NULL,
	"status" "InvoiceStatus" DEFAULT 'DRAFT' NOT NULL,
	"amount" integer NOT NULL,
	"amountPaid" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"dueDate" timestamp(3),
	"paidAt" timestamp(3),
	"description" text,
	"lineItems" jsonb NOT NULL,
	"notes" text,
	"isRecurring" boolean DEFAULT false NOT NULL,
	"subscriptionId" text,
	"stripePaymentIntentId" text,
	"stripeHostedInvoiceUrl" text,
	"stripePdfUrl" text,
	"metadata" jsonb,
	"createdBy" integer,
	"sentAt" timestamp(3),
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "FacebookPage" (
	"id" text PRIMARY KEY NOT NULL,
	"clientId" text NOT NULL,
	"pageId" text NOT NULL,
	"pageName" text NOT NULL,
	"pageAccessToken" text NOT NULL,
	"category" text,
	"profilePicture" text,
	"followerCount" integer DEFAULT 0 NOT NULL,
	"likeCount" integer DEFAULT 0 NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"lastSyncAt" timestamp(3),
	"syncStatus" "SyncStatus" DEFAULT 'PENDING' NOT NULL,
	"syncError" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "FacebookSnapshot" (
	"id" text PRIMARY KEY NOT NULL,
	"facebookPageId" text NOT NULL,
	"clientId" text NOT NULL,
	"date" date NOT NULL,
	"followers" integer DEFAULT 0 NOT NULL,
	"likes" integer DEFAULT 0 NOT NULL,
	"followersGained" integer DEFAULT 0 NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"reach" integer DEFAULT 0 NOT NULL,
	"engagement" integer DEFAULT 0 NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "PostedContent" (
	"id" text PRIMARY KEY NOT NULL,
	"clientId" text NOT NULL,
	"title" text,
	"platform" text NOT NULL,
	"url" text NOT NULL,
	"postedAt" timestamp(3) NOT NULL,
	"deliverableType" text,
	"taskId" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "SalesLeadGenerationJob" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"provider" text DEFAULT 'LINKEDIN' NOT NULL,
	"status" text DEFAULT 'QUEUED' NOT NULL,
	"externalJobId" text,
	"totalLeads" integer DEFAULT 0 NOT NULL,
	"importedLeads" integer DEFAULT 0 NOT NULL,
	"duplicateLeads" integer DEFAULT 0 NOT NULL,
	"requestedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"startedAt" timestamp(3),
	"completedAt" timestamp(3),
	"importedAt" timestamp(3),
	"errorMessage" text,
	"providerMessage" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "PostingTarget" (
	"id" text PRIMARY KEY NOT NULL,
	"clientId" text NOT NULL,
	"platform" text NOT NULL,
	"deliverableType" text NOT NULL,
	"count" integer NOT NULL,
	"frequency" text DEFAULT 'daily' NOT NULL,
	"extras" jsonb,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "EditorEodReport" (
	"id" text PRIMARY KEY NOT NULL,
	"editorId" integer NOT NULL,
	"reportDate" text NOT NULL,
	"slackChannel" text,
	"slackTs" text,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"notes" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "EditorEodReportItem" (
	"id" text PRIMARY KEY NOT NULL,
	"reportId" text NOT NULL,
	"taskId" text NOT NULL,
	"taskTitle" text NOT NULL,
	"proofLinks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"statusAtSend" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "NasSyncLog" (
	"id" text PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"completedAt" timestamp(3) NOT NULL,
	"bucketName" text,
	"paths" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"filesCount" integer,
	"bytesCount" bigint,
	"errorMessage" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "SalesLead" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"socials" text DEFAULT '' NOT NULL,
	"snapchatShow" text DEFAULT '' NOT NULL,
	"igDm" boolean DEFAULT false NOT NULL,
	"meetingBooked" boolean DEFAULT false NOT NULL,
	"emailed" boolean DEFAULT false NOT NULL,
	"called" boolean DEFAULT false NOT NULL,
	"texted" boolean DEFAULT false NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"emailTemplate" text DEFAULT '' NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"calledAt" timestamp(3),
	"dmAt" timestamp(3),
	"dmPlatform" text DEFAULT '' NOT NULL,
	"emailedAt" timestamp(3),
	"meetingAt" timestamp(3),
	"textedAt" timestamp(3),
	"company" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"source" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'NEW' NOT NULL,
	"value" double precision,
	"facebook" boolean DEFAULT false NOT NULL,
	"instagram" boolean DEFAULT false NOT NULL,
	"linkedin" boolean DEFAULT false NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"priority" text DEFAULT '' NOT NULL,
	"tiktok" boolean DEFAULT false NOT NULL,
	"twitter" boolean DEFAULT false NOT NULL,
	"externalId" text,
	"externalSource" text,
	"externalUrl" text,
	"postUrl" varchar(500),
	"profileUrl" varchar(500),
	"convertedAt" timestamp(3),
	"convertedToClientId" text
);
--> statement-breakpoint
CREATE TABLE "OnboardingToken" (
	"id" text PRIMARY KEY NOT NULL,
	"clientId" text NOT NULL,
	"token" text NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"usedAt" timestamp(3),
	"expiresAt" timestamp(3) NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"niche" varchar(100),
	"status" varchar(20) DEFAULT 'new' NOT NULL,
	"notes" text,
	"contactedAt" timestamp(3),
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"detectedNeed" varchar(300),
	"matchedService" varchar(200),
	"postText" text,
	"postUrl" varchar(500),
	"profileUrl" varchar(500) NOT NULL,
	"suggestedMessage" text
);
--> statement-breakpoint
CREATE TABLE "Contract" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" "ContractStatus" DEFAULT 'DRAFT' NOT NULL,
	"s3Key" text NOT NULL,
	"signedS3Key" text,
	"fileName" text NOT NULL,
	"fileSize" bigint NOT NULL,
	"createdById" integer NOT NULL,
	"clientId" text,
	"templateId" text,
	"expiresAt" timestamp(3),
	"completedAt" timestamp(3),
	"cancelledAt" timestamp(3),
	"message" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"annotations" jsonb,
	"allowVariableSigners" boolean DEFAULT false NOT NULL,
	"preClientId" text,
	"signwellDocumentId" text,
	"signwellRequestId" text,
	"requiresSignature" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "EmployeeDocument" (
	"id" text PRIMARY KEY NOT NULL,
	"employeeId" integer NOT NULL,
	"title" text NOT NULL,
	"s3Key" text NOT NULL,
	"fileName" text NOT NULL,
	"fileSize" integer NOT NULL,
	"uploadedById" integer NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Quote" (
	"id" text PRIMARY KEY NOT NULL,
	"preClientId" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" "QuoteStatus" DEFAULT 'DRAFT' NOT NULL,
	"services" jsonb NOT NULL,
	"totalAmount" integer NOT NULL,
	"notes" text,
	"validDays" integer DEFAULT 30 NOT NULL,
	"shareToken" text NOT NULL,
	"sentAt" timestamp(3),
	"viewedAt" timestamp(3),
	"acceptedAt" timestamp(3),
	"rejectedAt" timestamp(3),
	"rejectionReason" text,
	"changeRequest" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"acceptanceText" text,
	"inclusions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"preparedBy" text,
	"terms" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "TrainingDocument" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"s3Key" text NOT NULL,
	"fileName" text NOT NULL,
	"fileSize" integer NOT NULL,
	"role" "Role" NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"courseId" text
);
--> statement-breakpoint
CREATE TABLE "PreClient" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"companyName" text,
	"status" "PreClientStatus" DEFAULT 'QUALIFIED' NOT NULL,
	"createdById" integer NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"address" text
);
--> statement-breakpoint
CREATE TABLE "Client" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" integer,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"companyName" text,
	"phone" text NOT NULL,
	"createdBy" text,
	"status" text DEFAULT 'active' NOT NULL,
	"accountManagerId" text,
	"startDate" timestamp(3),
	"renewalDate" timestamp(3),
	"lastActivity" timestamp(3),
	"requiresClientReview" boolean DEFAULT false NOT NULL,
	"requiresVideographer" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"uploadedFiles" jsonb,
	"brandGuidelines" jsonb,
	"projectSettings" jsonb,
	"billing" jsonb,
	"postingSchedule" jsonb,
	"currentProgress" jsonb,
	"driveFolderId" text,
	"rawFootageFolderId" text,
	"essentialsFolderId" text,
	"emails" text[] DEFAULT '{"RAY"}',
	"phones" text[] DEFAULT '{"RAY"}',
	"outputsFolderId" text,
	"slackChannelName" text,
	"slackEnabled" boolean DEFAULT false NOT NULL,
	"slackWebhookUrl" text,
	"hasPostingServices" boolean DEFAULT true NOT NULL,
	"rawFootageStorageUsed" bigint DEFAULT 0,
	"rawFootageStorageLimit" bigint DEFAULT '3298534883328',
	"storageAlert90Sent" boolean DEFAULT false,
	"storageAlert95Sent" boolean DEFAULT false,
	"storageLastCalculated" timestamp,
	"isTrial" boolean DEFAULT false NOT NULL,
	"clientReviewDeliverableTypes" text[] DEFAULT '{"RAY"}',
	"rawFootageLinks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"portalPasswordSet" boolean DEFAULT false NOT NULL,
	"preClientId" text,
	"welcomeVideoWatched" boolean DEFAULT false NOT NULL,
	"requiresCoverImage" boolean DEFAULT false NOT NULL,
	"templateHashtags" text[] DEFAULT '{"RAY"}',
	"address" text
);
--> statement-breakpoint
CREATE TABLE "CommissionAdjustment" (
	"id" text PRIMARY KEY NOT NULL,
	"commissionId" text NOT NULL,
	"editedById" integer NOT NULL,
	"adjustmentType" text NOT NULL,
	"previousAmount" numeric(12, 2) NOT NULL,
	"newAmount" numeric(12, 2) NOT NULL,
	"reason" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "SalesManagerPermission" (
	"id" text PRIMARY KEY NOT NULL,
	"managerId" integer NOT NULL,
	"salesRepId" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "HelpVideo" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"youtubeUrl" text NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdById" integer NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "SalesActivityLog" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"type" text NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "PayoutBatchRun" (
	"id" text PRIMARY KEY NOT NULL,
	"runDate" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"status" text DEFAULT 'RUNNING' NOT NULL,
	"totalAmount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"totalPayouts" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"completedAt" timestamp(3)
);
--> statement-breakpoint
CREATE TABLE "SalesRepPayoutProfile" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"stripeConnectAccountId" text,
	"onboardingStatus" text DEFAULT 'NOT_STARTED' NOT NULL,
	"payoutsEnabled" boolean DEFAULT false NOT NULL,
	"taxFormType" text,
	"taxFormCollectedAt" timestamp(3),
	"country" text,
	"currency" text DEFAULT 'usd' NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"taxFormS3Key" text,
	"commissionRate" numeric(5, 4)
);
--> statement-breakpoint
CREATE TABLE "PayoutConfig" (
	"id" text PRIMARY KEY NOT NULL,
	"minimumThresholdCents" integer DEFAULT 2500 NOT NULL,
	"holdWindowDays" integer DEFAULT 5 NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"updatedById" integer
);
--> statement-breakpoint
CREATE TABLE "CommissionPayout" (
	"id" text PRIMARY KEY NOT NULL,
	"batchId" text,
	"salesUserId" integer NOT NULL,
	"stripeTransferId" text,
	"amount" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"failureReason" text,
	"idempotencyKey" text NOT NULL,
	"sentAt" timestamp(3),
	"paidAt" timestamp(3),
	"failedAt" timestamp(3),
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Tag" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "FolderStatus" (
	"id" text PRIMARY KEY NOT NULL,
	"clientId" text NOT NULL,
	"s3KeyPrefix" text NOT NULL,
	"status" text NOT NULL,
	"updatedById" integer,
	"updatedAt" timestamp(3) NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "HiringCandidate" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"portfolioUrl" text,
	"resumeUrl" text,
	"source" text,
	"notes" text,
	"status" "HiringCandidateStatus" DEFAULT 'NEW' NOT NULL,
	"createdById" integer,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"convertedAt" timestamp(3),
	"convertedUserId" integer
);
--> statement-breakpoint
CREATE TABLE "HiringTestTask" (
	"id" text PRIMARY KEY NOT NULL,
	"candidateId" text NOT NULL,
	"title" text NOT NULL,
	"instructions" text NOT NULL,
	"rawFootageUrl" text,
	"submissionToken" text NOT NULL,
	"status" "HiringTestTaskStatus" DEFAULT 'PENDING' NOT NULL,
	"submissionUrl" text,
	"submissionS3Key" text,
	"sentAt" timestamp(3),
	"submittedAt" timestamp(3),
	"reviewedById" integer,
	"reviewNotes" text,
	"reviewedAt" timestamp(3),
	"expiresAt" timestamp(3),
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "MeetingNote" (
	"id" text PRIMARY KEY NOT NULL,
	"clientId" text NOT NULL,
	"driveDocId" text NOT NULL,
	"driveDocUrl" text NOT NULL,
	"title" text NOT NULL,
	"meetingDate" timestamp(3) NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"sentAt" timestamp(3),
	"sentBy" text,
	"createdBy" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "SchedulerActivityDailySummary" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"date" timestamp(3) NOT NULL,
	"activeMinutes" integer DEFAULT 0 NOT NULL,
	"idleMinutes" integer DEFAULT 0 NOT NULL,
	"clickCount" integer DEFAULT 0 NOT NULL,
	"sessionCount" integer DEFAULT 0 NOT NULL,
	"firstEventAt" timestamp(3),
	"lastEventAt" timestamp(3)
);
--> statement-breakpoint
CREATE TABLE "PortfolioJourneyClient" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"sublabel" text,
	"iconKey" text,
	"order" integer DEFAULT 0 NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "PortfolioJourneyStep" (
	"id" text PRIMARY KEY NOT NULL,
	"clientId" text NOT NULL,
	"imageUrl" text NOT NULL,
	"caption" text NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "YoutubeQuotaUsage" (
	"id" text PRIMARY KEY NOT NULL,
	"date" text NOT NULL,
	"unitsUsed" integer DEFAULT 0 NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "NasMirrorJob" (
	"id" text PRIMARY KEY NOT NULL,
	"clientName" text NOT NULL,
	"monthFolder" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"scannedCount" integer DEFAULT 0 NOT NULL,
	"copiedCount" integer DEFAULT 0 NOT NULL,
	"verifiedCount" integer DEFAULT 0 NOT NULL,
	"deletedCount" integer DEFAULT 0 NOT NULL,
	"failedCount" integer DEFAULT 0 NOT NULL,
	"currentFile" text,
	"errorMessage" text,
	"triggeredById" integer,
	"startedAt" timestamp(3),
	"completedAt" timestamp(3),
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"folderPath" text,
	"folderType" text DEFAULT 'outputs' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "SchedulerActivityEvent" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"sessionId" text NOT NULL,
	"eventType" text NOT NULL,
	"path" text,
	"targetLabel" text,
	"targetTag" text,
	"metadata" jsonb,
	"timestamp" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ClientPortalAccess" (
	"id" text PRIMARY KEY NOT NULL,
	"clientId" text NOT NULL,
	"status" "PortalAccessStatus" DEFAULT 'ONBOARDING' NOT NULL,
	"billingAnchorDate" timestamp(3),
	"nextBillingDate" timestamp(3),
	"arrearsPolicy" text DEFAULT 'current_only' NOT NULL,
	"adminUnlockedById" integer,
	"adminUnlockedAt" timestamp(3),
	"lockedAt" timestamp(3),
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"autoInvoiceActive" boolean DEFAULT false NOT NULL,
	"dueDays" integer DEFAULT 15 NOT NULL,
	"recurringAmount" integer,
	"recurringDescription" text
);
--> statement-breakpoint
CREATE TABLE "StripeWebhookEvent" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "_TagToTask" (
	"A" text NOT NULL,
	"B" text NOT NULL,
	CONSTRAINT "_TagToTask_AB_pkey" PRIMARY KEY("A","B")
);
--> statement-breakpoint
ALTER TABLE "MonthlyDeliverable" ADD CONSTRAINT "MonthlyDeliverable_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "BrandAsset" ADD CONSTRAINT "BrandAsset_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "MonthlyRun" ADD CONSTRAINT "MonthlyRun_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Bonus" ADD CONSTRAINT "Bonus_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."User"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Leave" ADD CONSTRAINT "Leave_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."User"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Deduction" ADD CONSTRAINT "Deduction_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."User"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Deduction" ADD CONSTRAINT "Deduction_leaveId_fkey" FOREIGN KEY ("leaveId") REFERENCES "public"."Leave"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Payroll" ADD CONSTRAINT "Payroll_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."User"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "User" ADD CONSTRAINT "User_linkedClientId_fkey" FOREIGN KEY ("linkedClientId") REFERENCES "public"."Client"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "public"."User"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "FeedbackResponse" ADD CONSTRAINT "FeedbackResponse_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "public"."Feedback"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "FeedbackResponse" ADD CONSTRAINT "FeedbackResponse_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "public"."User"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "RecurringTask" ADD CONSTRAINT "RecurringTask_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "RecurringTask" ADD CONSTRAINT "RecurringTask_deliverableId_fkey" FOREIGN KEY ("deliverableId") REFERENCES "public"."MonthlyDeliverable"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "RecurringTask" ADD CONSTRAINT "RecurringTask_templateTaskId_fkey" FOREIGN KEY ("templateTaskId") REFERENCES "public"."Task"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "QCAchievement" ADD CONSTRAINT "QCAchievement_qcSpecialistId_fkey" FOREIGN KEY ("qcSpecialistId") REFERENCES "public"."User"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "UserSecurityPin" ADD CONSTRAINT "UserSecurityPin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "LoginAuditLog" ADD CONSTRAINT "LoginAuditLog_loginId_fkey" FOREIGN KEY ("loginId") REFERENCES "public"."SocialLogin"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "LoginAuditLog" ADD CONSTRAINT "LoginAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "QCAnalytics" ADD CONSTRAINT "QCAnalytics_qcSpecialistId_fkey" FOREIGN KEY ("qcSpecialistId") REFERENCES "public"."User"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "QCRejectionReason" ADD CONSTRAINT "QCRejectionReason_qcSpecialistId_fkey" FOREIGN KEY ("qcSpecialistId") REFERENCES "public"."User"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "QCMonthlyTrend" ADD CONSTRAINT "QCMonthlyTrend_qcSpecialistId_fkey" FOREIGN KEY ("qcSpecialistId") REFERENCES "public"."User"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "TaskFeedback" ADD CONSTRAINT "TaskFeedback_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "public"."Task"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "TaskFeedback" ADD CONSTRAINT "TaskFeedback_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "public"."File"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "TaskFeedback" ADD CONSTRAINT "TaskFeedback_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."User"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "QCCategoryMetrics" ADD CONSTRAINT "QCCategoryMetrics_qcSpecialistId_fkey" FOREIGN KEY ("qcSpecialistId") REFERENCES "public"."User"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Task" ADD CONSTRAINT "Task_monthlyDeliverableId_fkey" FOREIGN KEY ("monthlyDeliverableId") REFERENCES "public"."MonthlyDeliverable"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Task" ADD CONSTRAINT "Task_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "public"."User"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Task" ADD CONSTRAINT "Task_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Task" ADD CONSTRAINT "Task_clientUserId_fkey" FOREIGN KEY ("clientUserId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Task" ADD CONSTRAINT "Task_qcReviewedBy_fkey" FOREIGN KEY ("qcReviewedBy") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Task" ADD CONSTRAINT "Task_oneOffDeliverableId_fkey" FOREIGN KEY ("oneOffDeliverableId") REFERENCES "public"."OneOffDeliverable"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Task" ADD CONSTRAINT "Task_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "public"."Invoice"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Task" ADD CONSTRAINT "Task_relatedTaskId_fkey" FOREIGN KEY ("relatedTaskId") REFERENCES "public"."Task"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "UserTwoFactorAuth" ADD CONSTRAINT "UserTwoFactorAuth_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "SocialLogin" ADD CONSTRAINT "SocialLogin_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "SocialLogin" ADD CONSTRAINT "SocialLogin_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "public"."User"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "TitlingJob" ADD CONSTRAINT "TitlingJob_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "public"."Task"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "YouTubeSnapshot" ADD CONSTRAINT "YouTubeSnapshot_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "public"."YouTubeChannel"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "YouTubeSnapshot" ADD CONSTRAINT "YouTubeSnapshot_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "YouTubeVideoStat" ADD CONSTRAINT "YouTubeVideoStat_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "public"."YouTubeChannel"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "YouTubeChannel" ADD CONSTRAINT "YouTubeChannel_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ShootDetail" ADD CONSTRAINT "ShootDetail_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "public"."Task"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ShootDetail" ADD CONSTRAINT "ShootDetail_videographerId_fkey" FOREIGN KEY ("videographerId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "MetaAccount" ADD CONSTRAINT "MetaAccount_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "MetaSnapshot" ADD CONSTRAINT "MetaSnapshot_metaAccountId_fkey" FOREIGN KEY ("metaAccountId") REFERENCES "public"."MetaAccount"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "MetaSnapshot" ADD CONSTRAINT "MetaSnapshot_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ClientRevenue" ADD CONSTRAINT "ClientRevenue_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Job" ADD CONSTRAINT "Job_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Job" ADD CONSTRAINT "Job_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Job" ADD CONSTRAINT "Job_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "public"."Job"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Guideline" ADD CONSTRAINT "Guideline_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "EditorClientPermission" ADD CONSTRAINT "EditorClientPermission_editorId_fkey" FOREIGN KEY ("editorId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "EditorClientPermission" ADD CONSTRAINT "EditorClientPermission_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "File" ADD CONSTRAINT "File_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "public"."Task"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "TrainingVideo" ADD CONSTRAINT "TrainingVideo_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."TrainingCourse"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "PortfolioSubcategory" ADD CONSTRAINT "PortfolioSubcategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."PortfolioCategory"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "SocialPost" ADD CONSTRAINT "SocialPost_socialAccountId_fkey" FOREIGN KEY ("socialAccountId") REFERENCES "public"."SocialAccount"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "SocialPost" ADD CONSTRAINT "SocialPost_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "public"."Task"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "SocialAnalytics" ADD CONSTRAINT "SocialAnalytics_socialAccountId_fkey" FOREIGN KEY ("socialAccountId") REFERENCES "public"."SocialAccount"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ContractAuditLog" ADD CONSTRAINT "ContractAuditLog_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "public"."Contract"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "AffiliateCommission" ADD CONSTRAINT "AffiliateCommission_salesUserId_fkey" FOREIGN KEY ("salesUserId") REFERENCES "public"."User"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "AffiliateCommission" ADD CONSTRAINT "AffiliateCommission_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "public"."SalesLead"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "AffiliateCommission" ADD CONSTRAINT "AffiliateCommission_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "public"."CommissionPayout"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "SocialAccount" ADD CONSTRAINT "SocialAccount_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ContractSigner" ADD CONSTRAINT "ContractSigner_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "public"."Contract"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "OneOffDeliverable" ADD CONSTRAINT "OneOffDeliverable_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "OneOffDeliverable" ADD CONSTRAINT "OneOffDeliverable_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "public"."Invoice"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "PaymentMethod" ADD CONSTRAINT "PaymentMethod_stripeCustomerId_fkey" FOREIGN KEY ("stripeCustomerId") REFERENCES "public"."StripeCustomer"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_stripeCustomerId_fkey" FOREIGN KEY ("stripeCustomerId") REFERENCES "public"."StripeCustomer"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "public"."Invoice"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "StripeCustomer" ADD CONSTRAINT "StripeCustomer_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_stripeCustomerId_fkey" FOREIGN KEY ("stripeCustomerId") REFERENCES "public"."StripeCustomer"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "FacebookPage" ADD CONSTRAINT "FacebookPage_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "FacebookSnapshot" ADD CONSTRAINT "FacebookSnapshot_facebookPageId_fkey" FOREIGN KEY ("facebookPageId") REFERENCES "public"."FacebookPage"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "PostedContent" ADD CONSTRAINT "PostedContent_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "SalesLeadGenerationJob" ADD CONSTRAINT "SalesLeadGenerationJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "PostingTarget" ADD CONSTRAINT "PostingTarget_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "EditorEodReport" ADD CONSTRAINT "EditorEodReport_editorId_fkey" FOREIGN KEY ("editorId") REFERENCES "public"."User"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "EditorEodReportItem" ADD CONSTRAINT "EditorEodReportItem_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "public"."EditorEodReport"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "EditorEodReportItem" ADD CONSTRAINT "EditorEodReportItem_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "public"."Task"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "SalesLead" ADD CONSTRAINT "SalesLead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "OnboardingToken" ADD CONSTRAINT "OnboardingToken_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "public"."ContractTemplate"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "EmployeeDocument" ADD CONSTRAINT "EmployeeDocument_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "EmployeeDocument" ADD CONSTRAINT "EmployeeDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "public"."User"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_preClientId_fkey" FOREIGN KEY ("preClientId") REFERENCES "public"."PreClient"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "TrainingDocument" ADD CONSTRAINT "TrainingDocument_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."TrainingCourse"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "PreClient" ADD CONSTRAINT "PreClient_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Client" ADD CONSTRAINT "Client_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "CommissionAdjustment" ADD CONSTRAINT "CommissionAdjustment_commissionId_fkey" FOREIGN KEY ("commissionId") REFERENCES "public"."AffiliateCommission"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "CommissionAdjustment" ADD CONSTRAINT "CommissionAdjustment_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "public"."User"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "SalesManagerPermission" ADD CONSTRAINT "SalesManagerPermission_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "SalesManagerPermission" ADD CONSTRAINT "SalesManagerPermission_salesRepId_fkey" FOREIGN KEY ("salesRepId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "HelpVideo" ADD CONSTRAINT "HelpVideo_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "SalesActivityLog" ADD CONSTRAINT "SalesActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "SalesRepPayoutProfile" ADD CONSTRAINT "SalesRepPayoutProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "CommissionPayout" ADD CONSTRAINT "CommissionPayout_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "public"."PayoutBatchRun"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "CommissionPayout" ADD CONSTRAINT "CommissionPayout_salesUserId_fkey" FOREIGN KEY ("salesUserId") REFERENCES "public"."User"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "FolderStatus" ADD CONSTRAINT "FolderStatus_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "FolderStatus" ADD CONSTRAINT "FolderStatus_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "HiringCandidate" ADD CONSTRAINT "HiringCandidate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "HiringCandidate" ADD CONSTRAINT "HiringCandidate_convertedUserId_fkey" FOREIGN KEY ("convertedUserId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "HiringTestTask" ADD CONSTRAINT "HiringTestTask_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "public"."HiringCandidate"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "HiringTestTask" ADD CONSTRAINT "HiringTestTask_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "MeetingNote" ADD CONSTRAINT "MeetingNote_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "SchedulerActivityDailySummary" ADD CONSTRAINT "SchedulerActivityDailySummary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "PortfolioJourneyStep" ADD CONSTRAINT "PortfolioJourneyStep_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."PortfolioJourneyClient"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "NasMirrorJob" ADD CONSTRAINT "NasMirrorJob_triggeredById_fkey" FOREIGN KEY ("triggeredById") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "SchedulerActivityEvent" ADD CONSTRAINT "SchedulerActivityEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ClientPortalAccess" ADD CONSTRAINT "ClientPortalAccess_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ClientPortalAccess" ADD CONSTRAINT "ClientPortalAccess_adminUnlockedById_fkey" FOREIGN KEY ("adminUnlockedById") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "_TagToTask" ADD CONSTRAINT "_TagToTask_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Tag"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "_TagToTask" ADD CONSTRAINT "_TagToTask_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."Task"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken" USING btree ("identifier" text_ops,"token" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken" USING btree ("token" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "NotificationPreference_userId_channel_key" ON "NotificationPreference" USING btree ("userId" int4_ops,"channel" int4_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account" USING btree ("provider" text_ops,"providerAccountId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "Deduction_leaveId_key" ON "Deduction" USING btree ("leaveId" int4_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session" USING btree ("sessionToken" text_ops);--> statement-breakpoint
CREATE INDEX "User_email_idx" ON "User" USING btree ("email" text_ops);--> statement-breakpoint
CREATE INDEX "User_employeeStatus_idx" ON "User" USING btree ("employeeStatus" enum_ops);--> statement-breakpoint
CREATE INDEX "User_linkedClientId_idx" ON "User" USING btree ("linkedClientId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "User_phone_key" ON "User" USING btree ("phone" text_ops);--> statement-breakpoint
CREATE INDEX "User_role_idx" ON "User" USING btree ("role" enum_ops);--> statement-breakpoint
CREATE INDEX "AuditLog_action_idx" ON "AuditLog" USING btree ("action" text_ops);--> statement-breakpoint
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog" USING btree ("entity" text_ops,"entityId" text_ops);--> statement-breakpoint
CREATE INDEX "AuditLog_timestamp_idx" ON "AuditLog" USING btree ("timestamp" timestamp_ops);--> statement-breakpoint
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog" USING btree ("userId" int4_ops);--> statement-breakpoint
CREATE INDEX "Feedback_senderId_idx" ON "Feedback" USING btree ("senderId" int4_ops);--> statement-breakpoint
CREATE INDEX "Feedback_status_idx" ON "Feedback" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "FeedbackResponse_feedbackId_idx" ON "FeedbackResponse" USING btree ("feedbackId" text_ops);--> statement-breakpoint
CREATE INDEX "FeedbackResponse_senderId_idx" ON "FeedbackResponse" USING btree ("senderId" int4_ops);--> statement-breakpoint
CREATE INDEX "QCAchievement_achievementType_idx" ON "QCAchievement" USING btree ("achievementType" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "QCAchievement_qcSpecialistId_achievementType_key" ON "QCAchievement" USING btree ("qcSpecialistId" int4_ops,"achievementType" text_ops);--> statement-breakpoint
CREATE INDEX "QCAchievement_qcSpecialistId_idx" ON "QCAchievement" USING btree ("qcSpecialistId" int4_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "UserSecurityPin_userId_key" ON "UserSecurityPin" USING btree ("userId" int4_ops);--> statement-breakpoint
CREATE INDEX "LoginAuditLog_action_idx" ON "LoginAuditLog" USING btree ("action" text_ops);--> statement-breakpoint
CREATE INDEX "LoginAuditLog_createdAt_idx" ON "LoginAuditLog" USING btree ("createdAt" timestamp_ops);--> statement-breakpoint
CREATE INDEX "LoginAuditLog_loginId_idx" ON "LoginAuditLog" USING btree ("loginId" text_ops);--> statement-breakpoint
CREATE INDEX "LoginAuditLog_userId_idx" ON "LoginAuditLog" USING btree ("userId" int4_ops);--> statement-breakpoint
CREATE INDEX "QCAnalytics_calculatedAt_idx" ON "QCAnalytics" USING btree ("calculatedAt" timestamp_ops);--> statement-breakpoint
CREATE INDEX "QCAnalytics_period_idx" ON "QCAnalytics" USING btree ("period" text_ops);--> statement-breakpoint
CREATE INDEX "QCAnalytics_qcSpecialistId_idx" ON "QCAnalytics" USING btree ("qcSpecialistId" int4_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "QCAnalytics_qcSpecialistId_period_startDate_key" ON "QCAnalytics" USING btree ("qcSpecialistId" timestamp_ops,"period" int4_ops,"startDate" int4_ops);--> statement-breakpoint
CREATE INDEX "QCRejectionReason_qcSpecialistId_idx" ON "QCRejectionReason" USING btree ("qcSpecialistId" int4_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "QCRejectionReason_qcSpecialistId_reason_key" ON "QCRejectionReason" USING btree ("qcSpecialistId" int4_ops,"reason" text_ops);--> statement-breakpoint
CREATE INDEX "QCRejectionReason_reason_idx" ON "QCRejectionReason" USING btree ("reason" text_ops);--> statement-breakpoint
CREATE INDEX "QCMonthlyTrend_qcSpecialistId_idx" ON "QCMonthlyTrend" USING btree ("qcSpecialistId" int4_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "QCMonthlyTrend_qcSpecialistId_year_month_key" ON "QCMonthlyTrend" USING btree ("qcSpecialistId" int4_ops,"year" int4_ops,"month" int4_ops);--> statement-breakpoint
CREATE INDEX "QCMonthlyTrend_year_month_idx" ON "QCMonthlyTrend" USING btree ("year" int4_ops,"month" int4_ops);--> statement-breakpoint
CREATE INDEX "TaskFeedback_fileId_idx" ON "TaskFeedback" USING btree ("fileId" text_ops);--> statement-breakpoint
CREATE INDEX "TaskFeedback_taskId_folderType_idx" ON "TaskFeedback" USING btree ("taskId" text_ops,"folderType" text_ops);--> statement-breakpoint
CREATE INDEX "TaskFeedback_taskId_idx" ON "TaskFeedback" USING btree ("taskId" text_ops);--> statement-breakpoint
CREATE INDEX "QCCategoryMetrics_category_idx" ON "QCCategoryMetrics" USING btree ("category" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "QCCategoryMetrics_qcSpecialistId_category_period_startDate_key" ON "QCCategoryMetrics" USING btree ("qcSpecialistId" timestamp_ops,"category" text_ops,"period" timestamp_ops,"startDate" timestamp_ops);--> statement-breakpoint
CREATE INDEX "QCCategoryMetrics_qcSpecialistId_idx" ON "QCCategoryMetrics" USING btree ("qcSpecialistId" int4_ops);--> statement-breakpoint
CREATE INDEX "Task_assignedTo_idx" ON "Task" USING btree ("assignedTo" int4_ops);--> statement-breakpoint
CREATE INDEX "Task_assignedTo_status_idx" ON "Task" USING btree ("assignedTo" int4_ops,"status" enum_ops);--> statement-breakpoint
CREATE INDEX "Task_clientId_idx" ON "Task" USING btree ("clientId" text_ops);--> statement-breakpoint
CREATE INDEX "Task_clientId_monthlyDeliverableId_monthFolder_idx" ON "Task" USING btree ("clientId" text_ops,"monthlyDeliverableId" text_ops,"monthFolder" text_ops);--> statement-breakpoint
CREATE INDEX "Task_clientId_status_idx" ON "Task" USING btree ("clientId" enum_ops,"status" enum_ops);--> statement-breakpoint
CREATE INDEX "Task_clientUserId_idx" ON "Task" USING btree ("clientUserId" int4_ops);--> statement-breakpoint
CREATE INDEX "Task_createdAt_idx" ON "Task" USING btree ("createdAt" timestamp_ops);--> statement-breakpoint
CREATE INDEX "Task_dueDate_status_idx" ON "Task" USING btree ("dueDate" timestamp_ops,"status" timestamp_ops);--> statement-breakpoint
CREATE INDEX "Task_isExtra_idx" ON "Task" USING btree ("isExtra" bool_ops);--> statement-breakpoint
CREATE INDEX "Task_monthFolder_idx" ON "Task" USING btree ("monthFolder" text_ops);--> statement-breakpoint
CREATE INDEX "Task_qcReviewedBy_idx" ON "Task" USING btree ("qcReviewedBy" int4_ops);--> statement-breakpoint
CREATE INDEX "Task_qc_specialist_idx" ON "Task" USING btree ("qc_specialist" int4_ops);--> statement-breakpoint
CREATE INDEX "Task_scheduler_idx" ON "Task" USING btree ("scheduler" int4_ops);--> statement-breakpoint
CREATE INDEX "Task_status_idx" ON "Task" USING btree ("status" enum_ops);--> statement-breakpoint
CREATE INDEX "Task_videographer_idx" ON "Task" USING btree ("videographer" int4_ops);--> statement-breakpoint
CREATE INDEX "UserTwoFactorAuth_userId_idx" ON "UserTwoFactorAuth" USING btree ("userId" int4_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "UserTwoFactorAuth_userId_key" ON "UserTwoFactorAuth" USING btree ("userId" int4_ops);--> statement-breakpoint
CREATE INDEX "ShareableReview_createdBy_idx" ON "ShareableReview" USING btree ("createdBy" int4_ops);--> statement-breakpoint
CREATE INDEX "ShareableReview_expiresAt_idx" ON "ShareableReview" USING btree ("expiresAt" timestamp_ops);--> statement-breakpoint
CREATE INDEX "ShareableReview_shareToken_idx" ON "ShareableReview" USING btree ("shareToken" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "ShareableReview_shareToken_key" ON "ShareableReview" USING btree ("shareToken" text_ops);--> statement-breakpoint
CREATE INDEX "SocialLogin_adminOnly_idx" ON "SocialLogin" USING btree ("adminOnly" bool_ops);--> statement-breakpoint
CREATE INDEX "SocialLogin_clientId_idx" ON "SocialLogin" USING btree ("clientId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "SocialLogin_clientId_platform_key" ON "SocialLogin" USING btree ("clientId" text_ops,"platform" text_ops);--> statement-breakpoint
CREATE INDEX "SocialLogin_platform_idx" ON "SocialLogin" USING btree ("platform" text_ops);--> statement-breakpoint
CREATE INDEX "TitlingJob_assemblyId_idx" ON "TitlingJob" USING btree ("assemblyId" text_ops);--> statement-breakpoint
CREATE INDEX "TitlingJob_createdAt_idx" ON "TitlingJob" USING btree ("createdAt" timestamp_ops);--> statement-breakpoint
CREATE INDEX "TitlingJob_status_idx" ON "TitlingJob" USING btree ("status" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "TitlingJob_taskId_key" ON "TitlingJob" USING btree ("taskId" text_ops);--> statement-breakpoint
CREATE INDEX "ActivityReport_generatedAt_idx" ON "ActivityReport" USING btree ("generatedAt" timestamp_ops);--> statement-breakpoint
CREATE INDEX "ActivityReport_reportDate_idx" ON "ActivityReport" USING btree ("reportDate" timestamp_ops);--> statement-breakpoint
CREATE INDEX "ShareableFile_createdBy_idx" ON "ShareableFile" USING btree ("createdBy" int4_ops);--> statement-breakpoint
CREATE INDEX "ShareableFile_shareToken_idx" ON "ShareableFile" USING btree ("shareToken" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "ShareableFile_shareToken_key" ON "ShareableFile" USING btree ("shareToken" text_ops);--> statement-breakpoint
CREATE INDEX "Notification_createdAt_idx" ON "Notification" USING btree ("createdAt" timestamp_ops);--> statement-breakpoint
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification" USING btree ("userId" int4_ops,"createdAt" timestamp_ops);--> statement-breakpoint
CREATE INDEX "Notification_userId_read_idx" ON "Notification" USING btree ("userId" bool_ops,"read" bool_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "YouTubeSnapshot_channelId_dateRange_key" ON "YouTubeSnapshot" USING btree ("channelId" text_ops,"dateRange" text_ops);--> statement-breakpoint
CREATE INDEX "YouTubeSnapshot_channelId_idx" ON "YouTubeSnapshot" USING btree ("channelId" text_ops);--> statement-breakpoint
CREATE INDEX "YouTubeSnapshot_clientId_idx" ON "YouTubeSnapshot" USING btree ("clientId" text_ops);--> statement-breakpoint
CREATE INDEX "YouTubeSnapshot_dateRange_idx" ON "YouTubeSnapshot" USING btree ("dateRange" text_ops);--> statement-breakpoint
CREATE INDEX "YouTubeSnapshot_snapshotDate_idx" ON "YouTubeSnapshot" USING btree ("snapshotDate" timestamp_ops);--> statement-breakpoint
CREATE INDEX "YouTubeVideoStat_channelId_idx" ON "YouTubeVideoStat" USING btree ("channelId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "YouTubeVideoStat_channelId_videoId_key" ON "YouTubeVideoStat" USING btree ("channelId" text_ops,"videoId" text_ops);--> statement-breakpoint
CREATE INDEX "YouTubeVideoStat_publishedAt_idx" ON "YouTubeVideoStat" USING btree ("publishedAt" timestamp_ops);--> statement-breakpoint
CREATE INDEX "YouTubeVideoStat_videoId_idx" ON "YouTubeVideoStat" USING btree ("videoId" text_ops);--> statement-breakpoint
CREATE INDEX "YouTubeVideoStat_views_idx" ON "YouTubeVideoStat" USING btree ("views" int8_ops);--> statement-breakpoint
CREATE INDEX "YouTubeChannel_channelId_idx" ON "YouTubeChannel" USING btree ("channelId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "YouTubeChannel_channelId_key" ON "YouTubeChannel" USING btree ("channelId" text_ops);--> statement-breakpoint
CREATE INDEX "YouTubeChannel_clientId_idx" ON "YouTubeChannel" USING btree ("clientId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "YouTubeChannel_clientId_key" ON "YouTubeChannel" USING btree ("clientId" text_ops);--> statement-breakpoint
CREATE INDEX "YouTubeChannel_syncStatus_idx" ON "YouTubeChannel" USING btree ("syncStatus" enum_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "ShootDetail_taskId_key" ON "ShootDetail" USING btree ("taskId" text_ops);--> statement-breakpoint
CREATE INDEX "MetaAccount_clientId_idx" ON "MetaAccount" USING btree ("clientId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "MetaAccount_clientId_key" ON "MetaAccount" USING btree ("clientId" text_ops);--> statement-breakpoint
CREATE INDEX "MetaAccount_instagramId_idx" ON "MetaAccount" USING btree ("instagramId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "MetaAccount_instagramId_key" ON "MetaAccount" USING btree ("instagramId" text_ops);--> statement-breakpoint
CREATE INDEX "MetaAccount_syncStatus_idx" ON "MetaAccount" USING btree ("syncStatus" enum_ops);--> statement-breakpoint
CREATE INDEX "MetaSnapshot_clientId_idx" ON "MetaSnapshot" USING btree ("clientId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "MetaSnapshot_metaAccountId_dateRange_key" ON "MetaSnapshot" USING btree ("metaAccountId" text_ops,"dateRange" text_ops);--> statement-breakpoint
CREATE INDEX "MetaSnapshot_metaAccountId_idx" ON "MetaSnapshot" USING btree ("metaAccountId" text_ops);--> statement-breakpoint
CREATE INDEX "MetaSnapshot_snapshotDate_idx" ON "MetaSnapshot" USING btree ("snapshotDate" timestamp_ops);--> statement-breakpoint
CREATE INDEX "ClientRevenue_clientId_idx" ON "ClientRevenue" USING btree ("clientId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "ClientRevenue_clientId_platform_period_source_key" ON "ClientRevenue" USING btree ("clientId" text_ops,"platform" text_ops,"period" timestamp_ops,"source" timestamp_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "RolePermission_role_key" ON "RolePermission" USING btree ("role" enum_ops);--> statement-breakpoint
CREATE INDEX "Job_assignedToId_idx" ON "Job" USING btree ("assignedToId" int4_ops);--> statement-breakpoint
CREATE INDEX "Job_clientId_idx" ON "Job" USING btree ("clientId" text_ops);--> statement-breakpoint
CREATE INDEX "Job_createdById_idx" ON "Job" USING btree ("createdById" int4_ops);--> statement-breakpoint
CREATE INDEX "Job_status_idx" ON "Job" USING btree ("status" enum_ops);--> statement-breakpoint
CREATE INDEX "Bid_jobId_idx" ON "Bid" USING btree ("jobId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "Bid_jobId_userId_key" ON "Bid" USING btree ("jobId" int4_ops,"userId" text_ops);--> statement-breakpoint
CREATE INDEX "Bid_userId_idx" ON "Bid" USING btree ("userId" int4_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "EditorClientPermission_editorId_clientId_key" ON "EditorClientPermission" USING btree ("editorId" int4_ops,"clientId" int4_ops);--> statement-breakpoint
CREATE INDEX "EditorClientPermission_editorId_idx" ON "EditorClientPermission" USING btree ("editorId" int4_ops);--> statement-breakpoint
CREATE INDEX "File_taskId_folderType_idx" ON "File" USING btree ("taskId" text_ops,"folderType" text_ops);--> statement-breakpoint
CREATE INDEX "File_taskId_isActive_idx" ON "File" USING btree ("taskId" text_ops,"isActive" text_ops);--> statement-breakpoint
CREATE INDEX "TrainingCourse_role_idx" ON "TrainingCourse" USING btree ("role" enum_ops);--> statement-breakpoint
CREATE INDEX "TrainingCourse_role_order_idx" ON "TrainingCourse" USING btree ("role" int4_ops,"order" int4_ops);--> statement-breakpoint
CREATE INDEX "TrainingVideo_courseId_order_idx" ON "TrainingVideo" USING btree ("courseId" int4_ops,"order" text_ops);--> statement-breakpoint
CREATE INDEX "TrainingVideo_role_idx" ON "TrainingVideo" USING btree ("role" enum_ops);--> statement-breakpoint
CREATE INDEX "TrainingVideo_role_order_idx" ON "TrainingVideo" USING btree ("role" enum_ops,"order" enum_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "PortfolioSubcategory_key_key" ON "PortfolioSubcategory" USING btree ("key" text_ops);--> statement-breakpoint
CREATE INDEX "SalesDashboardColumn_userId_idx" ON "SalesDashboardColumn" USING btree ("userId" int4_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "SalesDashboardColumn_userId_name_key" ON "SalesDashboardColumn" USING btree ("userId" int4_ops,"name" int4_ops);--> statement-breakpoint
CREATE INDEX "PortfolioLead_createdAt_idx" ON "PortfolioLead" USING btree ("createdAt" timestamp_ops);--> statement-breakpoint
CREATE INDEX "PortfolioLead_email_idx" ON "PortfolioLead" USING btree ("email" text_ops);--> statement-breakpoint
CREATE INDEX "PortfolioVideo_category_idx" ON "PortfolioVideo" USING btree ("category" text_ops);--> statement-breakpoint
CREATE INDEX "PortfolioVideo_category_order_idx" ON "PortfolioVideo" USING btree ("category" int4_ops,"order" int4_ops);--> statement-breakpoint
CREATE INDEX "PortfolioVideo_isActive_idx" ON "PortfolioVideo" USING btree ("isActive" bool_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "PortfolioCategory_key_key" ON "PortfolioCategory" USING btree ("key" text_ops);--> statement-breakpoint
CREATE INDEX "SocialPost_publishedAt_idx" ON "SocialPost" USING btree ("publishedAt" timestamp_ops);--> statement-breakpoint
CREATE INDEX "SocialPost_socialAccountId_idx" ON "SocialPost" USING btree ("socialAccountId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "SocialPost_socialAccountId_platformPostId_key" ON "SocialPost" USING btree ("socialAccountId" text_ops,"platformPostId" text_ops);--> statement-breakpoint
CREATE INDEX "SocialAnalytics_socialAccountId_date_idx" ON "SocialAnalytics" USING btree ("socialAccountId" date_ops,"date" date_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "SocialAnalytics_socialAccountId_date_key" ON "SocialAnalytics" USING btree ("socialAccountId" date_ops,"date" date_ops);--> statement-breakpoint
CREATE INDEX "ContractTemplate_createdById_idx" ON "ContractTemplate" USING btree ("createdById" int4_ops);--> statement-breakpoint
CREATE INDEX "ContractTemplate_isActive_idx" ON "ContractTemplate" USING btree ("isActive" bool_ops);--> statement-breakpoint
CREATE INDEX "ContractAuditLog_action_idx" ON "ContractAuditLog" USING btree ("action" text_ops);--> statement-breakpoint
CREATE INDEX "ContractAuditLog_contractId_idx" ON "ContractAuditLog" USING btree ("contractId" text_ops);--> statement-breakpoint
CREATE INDEX "ContractAuditLog_createdAt_idx" ON "ContractAuditLog" USING btree ("createdAt" timestamp_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "AffiliateCommission_leadId_key" ON "AffiliateCommission" USING btree ("leadId" text_ops);--> statement-breakpoint
CREATE INDEX "AffiliateCommission_month_idx" ON "AffiliateCommission" USING btree ("month" timestamp_ops);--> statement-breakpoint
CREATE INDEX "AffiliateCommission_payoutId_idx" ON "AffiliateCommission" USING btree ("payoutId" text_ops);--> statement-breakpoint
CREATE INDEX "AffiliateCommission_salesUserId_idx" ON "AffiliateCommission" USING btree ("salesUserId" int4_ops);--> statement-breakpoint
CREATE INDEX "AffiliateCommission_status_idx" ON "AffiliateCommission" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "SocialAccount_clientId_idx" ON "SocialAccount" USING btree ("clientId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "SocialAccount_clientId_platform_platformId_key" ON "SocialAccount" USING btree ("clientId" text_ops,"platform" text_ops,"platformId" text_ops);--> statement-breakpoint
CREATE INDEX "SocialAccount_platform_idx" ON "SocialAccount" USING btree ("platform" text_ops);--> statement-breakpoint
CREATE INDEX "ContractSigner_contractId_idx" ON "ContractSigner" USING btree ("contractId" text_ops);--> statement-breakpoint
CREATE INDEX "ContractSigner_email_idx" ON "ContractSigner" USING btree ("email" text_ops);--> statement-breakpoint
CREATE INDEX "ContractSigner_signToken_idx" ON "ContractSigner" USING btree ("signToken" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "ContractSigner_signToken_key" ON "ContractSigner" USING btree ("signToken" text_ops);--> statement-breakpoint
CREATE INDEX "ContractSigner_status_idx" ON "ContractSigner" USING btree ("status" enum_ops);--> statement-breakpoint
CREATE INDEX "PaymentMethod_stripeCustomerId_idx" ON "PaymentMethod" USING btree ("stripeCustomerId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "PaymentMethod_stripePaymentMethodId_key" ON "PaymentMethod" USING btree ("stripePaymentMethodId" text_ops);--> statement-breakpoint
CREATE INDEX "Subscription_status_idx" ON "Subscription" USING btree ("status" enum_ops);--> statement-breakpoint
CREATE INDEX "Subscription_stripeCustomerId_idx" ON "Subscription" USING btree ("stripeCustomerId" text_ops);--> statement-breakpoint
CREATE INDEX "Subscription_stripeSubscriptionId_idx" ON "Subscription" USING btree ("stripeSubscriptionId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "Subscription" USING btree ("stripeSubscriptionId" text_ops);--> statement-breakpoint
CREATE INDEX "Payment_invoiceId_idx" ON "Payment" USING btree ("invoiceId" text_ops);--> statement-breakpoint
CREATE INDEX "Payment_status_idx" ON "Payment" USING btree ("status" enum_ops);--> statement-breakpoint
CREATE INDEX "Payment_stripePaymentIntentId_idx" ON "Payment" USING btree ("stripePaymentIntentId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "Payment_stripePaymentIntentId_key" ON "Payment" USING btree ("stripePaymentIntentId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "StripeCustomer_clientId_key" ON "StripeCustomer" USING btree ("clientId" text_ops);--> statement-breakpoint
CREATE INDEX "StripeCustomer_stripeCustomerId_idx" ON "StripeCustomer" USING btree ("stripeCustomerId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "StripeCustomer_stripeCustomerId_key" ON "StripeCustomer" USING btree ("stripeCustomerId" text_ops);--> statement-breakpoint
CREATE INDEX "BillingPlan_isActive_idx" ON "BillingPlan" USING btree ("isActive" bool_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "BillingPlan_stripePriceId_key" ON "BillingPlan" USING btree ("stripePriceId" text_ops);--> statement-breakpoint
CREATE INDEX "Invoice_dueDate_idx" ON "Invoice" USING btree ("dueDate" timestamp_ops);--> statement-breakpoint
CREATE INDEX "Invoice_invoiceNumber_idx" ON "Invoice" USING btree ("invoiceNumber" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice" USING btree ("invoiceNumber" text_ops);--> statement-breakpoint
CREATE INDEX "Invoice_status_idx" ON "Invoice" USING btree ("status" enum_ops);--> statement-breakpoint
CREATE INDEX "Invoice_stripeCustomerId_idx" ON "Invoice" USING btree ("stripeCustomerId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "Invoice_stripeInvoiceId_key" ON "Invoice" USING btree ("stripeInvoiceId" text_ops);--> statement-breakpoint
CREATE INDEX "FacebookPage_clientId_idx" ON "FacebookPage" USING btree ("clientId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "FacebookPage_clientId_pageId_key" ON "FacebookPage" USING btree ("clientId" text_ops,"pageId" text_ops);--> statement-breakpoint
CREATE INDEX "FacebookPage_pageId_idx" ON "FacebookPage" USING btree ("pageId" text_ops);--> statement-breakpoint
CREATE INDEX "FacebookPage_syncStatus_idx" ON "FacebookPage" USING btree ("syncStatus" enum_ops);--> statement-breakpoint
CREATE INDEX "FacebookSnapshot_clientId_idx" ON "FacebookSnapshot" USING btree ("clientId" text_ops);--> statement-breakpoint
CREATE INDEX "FacebookSnapshot_date_idx" ON "FacebookSnapshot" USING btree ("date" date_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "FacebookSnapshot_facebookPageId_date_key" ON "FacebookSnapshot" USING btree ("facebookPageId" date_ops,"date" text_ops);--> statement-breakpoint
CREATE INDEX "FacebookSnapshot_facebookPageId_idx" ON "FacebookSnapshot" USING btree ("facebookPageId" text_ops);--> statement-breakpoint
CREATE INDEX "PostedContent_clientId_idx" ON "PostedContent" USING btree ("clientId" text_ops);--> statement-breakpoint
CREATE INDEX "PostedContent_clientId_postedAt_idx" ON "PostedContent" USING btree ("clientId" text_ops,"postedAt" timestamp_ops);--> statement-breakpoint
CREATE INDEX "PostedContent_platform_idx" ON "PostedContent" USING btree ("platform" text_ops);--> statement-breakpoint
CREATE INDEX "PostedContent_postedAt_idx" ON "PostedContent" USING btree ("postedAt" timestamp_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "SalesLeadGenerationJob_externalJobId_key" ON "SalesLeadGenerationJob" USING btree ("externalJobId" text_ops);--> statement-breakpoint
CREATE INDEX "SalesLeadGenerationJob_provider_userId_idx" ON "SalesLeadGenerationJob" USING btree ("provider" int4_ops,"userId" text_ops);--> statement-breakpoint
CREATE INDEX "SalesLeadGenerationJob_status_idx" ON "SalesLeadGenerationJob" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "SalesLeadGenerationJob_userId_createdAt_idx" ON "SalesLeadGenerationJob" USING btree ("userId" timestamp_ops,"createdAt" int4_ops);--> statement-breakpoint
CREATE INDEX "PostingTarget_clientId_idx" ON "PostingTarget" USING btree ("clientId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "PostingTarget_clientId_platform_deliverableType_key" ON "PostingTarget" USING btree ("clientId" text_ops,"platform" text_ops,"deliverableType" text_ops);--> statement-breakpoint
CREATE INDEX "EditorEodReport_editorId_idx" ON "EditorEodReport" USING btree ("editorId" int4_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "EditorEodReport_editorId_reportDate_key" ON "EditorEodReport" USING btree ("editorId" int4_ops,"reportDate" text_ops);--> statement-breakpoint
CREATE INDEX "EditorEodReport_reportDate_idx" ON "EditorEodReport" USING btree ("reportDate" text_ops);--> statement-breakpoint
CREATE INDEX "EditorEodReportItem_reportId_idx" ON "EditorEodReportItem" USING btree ("reportId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "EditorEodReportItem_reportId_taskId_key" ON "EditorEodReportItem" USING btree ("reportId" text_ops,"taskId" text_ops);--> statement-breakpoint
CREATE INDEX "EditorEodReportItem_taskId_idx" ON "EditorEodReportItem" USING btree ("taskId" text_ops);--> statement-breakpoint
CREATE INDEX "NasSyncLog_completedAt_idx" ON "NasSyncLog" USING btree ("completedAt" timestamp_ops);--> statement-breakpoint
CREATE INDEX "NasSyncLog_status_idx" ON "NasSyncLog" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "SalesLead_externalSource_externalId_idx" ON "SalesLead" USING btree ("externalSource" text_ops,"externalId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "SalesLead_externalSource_externalId_key" ON "SalesLead" USING btree ("externalSource" text_ops,"externalId" text_ops);--> statement-breakpoint
CREATE INDEX "SalesLead_status_idx" ON "SalesLead" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "SalesLead_userId_idx" ON "SalesLead" USING btree ("userId" int4_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "OnboardingToken_clientId_key" ON "OnboardingToken" USING btree ("clientId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "OnboardingToken_token_key" ON "OnboardingToken" USING btree ("token" text_ops);--> statement-breakpoint
CREATE INDEX "leads_createdAt_idx" ON "leads" USING btree ("createdAt" timestamp_ops);--> statement-breakpoint
CREATE INDEX "leads_profileUrl_idx" ON "leads" USING btree ("profileUrl" text_ops);--> statement-breakpoint
CREATE INDEX "leads_status_idx" ON "leads" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "Contract_clientId_idx" ON "Contract" USING btree ("clientId" text_ops);--> statement-breakpoint
CREATE INDEX "Contract_createdAt_idx" ON "Contract" USING btree ("createdAt" timestamp_ops);--> statement-breakpoint
CREATE INDEX "Contract_createdById_idx" ON "Contract" USING btree ("createdById" int4_ops);--> statement-breakpoint
CREATE INDEX "Contract_status_idx" ON "Contract" USING btree ("status" enum_ops);--> statement-breakpoint
CREATE INDEX "EmployeeDocument_employeeId_idx" ON "EmployeeDocument" USING btree ("employeeId" int4_ops);--> statement-breakpoint
CREATE INDEX "Quote_preClientId_idx" ON "Quote" USING btree ("preClientId" text_ops);--> statement-breakpoint
CREATE INDEX "Quote_shareToken_idx" ON "Quote" USING btree ("shareToken" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "Quote_shareToken_key" ON "Quote" USING btree ("shareToken" text_ops);--> statement-breakpoint
CREATE INDEX "Quote_status_idx" ON "Quote" USING btree ("status" enum_ops);--> statement-breakpoint
CREATE INDEX "TrainingDocument_courseId_order_idx" ON "TrainingDocument" USING btree ("courseId" int4_ops,"order" text_ops);--> statement-breakpoint
CREATE INDEX "TrainingDocument_role_idx" ON "TrainingDocument" USING btree ("role" enum_ops);--> statement-breakpoint
CREATE INDEX "TrainingDocument_role_order_idx" ON "TrainingDocument" USING btree ("role" enum_ops,"order" enum_ops);--> statement-breakpoint
CREATE INDEX "PreClient_createdById_idx" ON "PreClient" USING btree ("createdById" int4_ops);--> statement-breakpoint
CREATE INDEX "PreClient_status_idx" ON "PreClient" USING btree ("status" enum_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "Client_preClientId_key" ON "Client" USING btree ("preClientId" text_ops);--> statement-breakpoint
CREATE INDEX "Client_status_idx" ON "Client" USING btree ("status" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "Client_userId_key" ON "Client" USING btree ("userId" int4_ops);--> statement-breakpoint
CREATE INDEX "CommissionAdjustment_commissionId_idx" ON "CommissionAdjustment" USING btree ("commissionId" text_ops);--> statement-breakpoint
CREATE INDEX "SalesManagerPermission_managerId_idx" ON "SalesManagerPermission" USING btree ("managerId" int4_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "SalesManagerPermission_managerId_salesRepId_key" ON "SalesManagerPermission" USING btree ("managerId" int4_ops,"salesRepId" int4_ops);--> statement-breakpoint
CREATE INDEX "HelpVideo_isActive_idx" ON "HelpVideo" USING btree ("isActive" bool_ops);--> statement-breakpoint
CREATE INDEX "HelpVideo_order_idx" ON "HelpVideo" USING btree ("order" int4_ops);--> statement-breakpoint
CREATE INDEX "SalesActivityLog_type_idx" ON "SalesActivityLog" USING btree ("type" text_ops);--> statement-breakpoint
CREATE INDEX "SalesActivityLog_userId_createdAt_idx" ON "SalesActivityLog" USING btree ("userId" int4_ops,"createdAt" int4_ops);--> statement-breakpoint
CREATE INDEX "SalesRepPayoutProfile_stripeConnectAccountId_idx" ON "SalesRepPayoutProfile" USING btree ("stripeConnectAccountId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "SalesRepPayoutProfile_stripeConnectAccountId_key" ON "SalesRepPayoutProfile" USING btree ("stripeConnectAccountId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "SalesRepPayoutProfile_userId_key" ON "SalesRepPayoutProfile" USING btree ("userId" int4_ops);--> statement-breakpoint
CREATE INDEX "CommissionPayout_batchId_idx" ON "CommissionPayout" USING btree ("batchId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "CommissionPayout_idempotencyKey_key" ON "CommissionPayout" USING btree ("idempotencyKey" text_ops);--> statement-breakpoint
CREATE INDEX "CommissionPayout_salesUserId_idx" ON "CommissionPayout" USING btree ("salesUserId" int4_ops);--> statement-breakpoint
CREATE INDEX "CommissionPayout_status_idx" ON "CommissionPayout" USING btree ("status" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "CommissionPayout_stripeTransferId_key" ON "CommissionPayout" USING btree ("stripeTransferId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag" USING btree ("name" text_ops);--> statement-breakpoint
CREATE INDEX "FolderStatus_clientId_idx" ON "FolderStatus" USING btree ("clientId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "FolderStatus_clientId_s3KeyPrefix_key" ON "FolderStatus" USING btree ("clientId" text_ops,"s3KeyPrefix" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "HiringCandidate_convertedUserId_key" ON "HiringCandidate" USING btree ("convertedUserId" int4_ops);--> statement-breakpoint
CREATE INDEX "HiringCandidate_email_idx" ON "HiringCandidate" USING btree ("email" text_ops);--> statement-breakpoint
CREATE INDEX "HiringCandidate_status_idx" ON "HiringCandidate" USING btree ("status" enum_ops);--> statement-breakpoint
CREATE INDEX "HiringTestTask_candidateId_idx" ON "HiringTestTask" USING btree ("candidateId" text_ops);--> statement-breakpoint
CREATE INDEX "HiringTestTask_status_idx" ON "HiringTestTask" USING btree ("status" enum_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "HiringTestTask_submissionToken_key" ON "HiringTestTask" USING btree ("submissionToken" text_ops);--> statement-breakpoint
CREATE INDEX "MeetingNote_clientId_idx" ON "MeetingNote" USING btree ("clientId" text_ops);--> statement-breakpoint
CREATE INDEX "SchedulerActivityDailySummary_userId_date_idx" ON "SchedulerActivityDailySummary" USING btree ("userId" int4_ops,"date" int4_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "SchedulerActivityDailySummary_userId_date_key" ON "SchedulerActivityDailySummary" USING btree ("userId" int4_ops,"date" int4_ops);--> statement-breakpoint
CREATE INDEX "PortfolioJourneyStep_clientId_idx" ON "PortfolioJourneyStep" USING btree ("clientId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "YoutubeQuotaUsage_date_key" ON "YoutubeQuotaUsage" USING btree ("date" text_ops);--> statement-breakpoint
CREATE INDEX "NasMirrorJob_clientName_monthFolder_idx" ON "NasMirrorJob" USING btree ("clientName" text_ops,"monthFolder" text_ops);--> statement-breakpoint
CREATE INDEX "NasMirrorJob_createdAt_idx" ON "NasMirrorJob" USING btree ("createdAt" timestamp_ops);--> statement-breakpoint
CREATE INDEX "NasMirrorJob_status_idx" ON "NasMirrorJob" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "SchedulerActivityEvent_eventType_idx" ON "SchedulerActivityEvent" USING btree ("eventType" text_ops);--> statement-breakpoint
CREATE INDEX "SchedulerActivityEvent_sessionId_idx" ON "SchedulerActivityEvent" USING btree ("sessionId" text_ops);--> statement-breakpoint
CREATE INDEX "SchedulerActivityEvent_userId_timestamp_idx" ON "SchedulerActivityEvent" USING btree ("userId" timestamp_ops,"timestamp" int4_ops);--> statement-breakpoint
CREATE INDEX "ClientPortalAccess_autoInvoiceActive_idx" ON "ClientPortalAccess" USING btree ("autoInvoiceActive" bool_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "ClientPortalAccess_clientId_key" ON "ClientPortalAccess" USING btree ("clientId" text_ops);--> statement-breakpoint
CREATE INDEX "ClientPortalAccess_nextBillingDate_idx" ON "ClientPortalAccess" USING btree ("nextBillingDate" timestamp_ops);--> statement-breakpoint
CREATE INDEX "ClientPortalAccess_status_idx" ON "ClientPortalAccess" USING btree ("status" enum_ops);--> statement-breakpoint
CREATE INDEX "StripeWebhookEvent_createdAt_idx" ON "StripeWebhookEvent" USING btree ("createdAt" timestamp_ops);--> statement-breakpoint
CREATE INDEX "_TagToTask_B_index" ON "_TagToTask" USING btree ("B" text_ops);
*/