-- Financials 2: ledger, bank accounts, contractors (W-9), expenses, goals/KPIs.
-- Mirrors src/lib/db/schema.ts. Idempotent: safe to re-run.

-- ── Enums ────────────────────────────────────────────────────────────────
DO $$ BEGIN CREATE TYPE "AccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "BankAccountType" AS ENUM ('CHECKING', 'SAVINGS', 'CREDIT_CARD', 'CASH', 'OTHER'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "ContractorStatus" AS ENUM ('ACTIVE', 'INACTIVE'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "ExpenseStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'REIMBURSED'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "GoalMetricType" AS ENUM ('REVENUE', 'PROFIT', 'EXPENSE_CAP', 'CUSTOM'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "GoalPeriod" AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "LedgerSourceType" AS ENUM ('CLIENT_PAYMENT', 'CONTRACTOR_PAYOUT', 'PAYROLL', 'EXPENSE_REIMBURSEMENT', 'MANUAL'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "W9Status" AS ENUM ('PENDING', 'SUBMITTED', 'VERIFIED', 'EXPIRED'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── Tables ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "LedgerAccount" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"type" "AccountType" NOT NULL,
	"parentId" text,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS "BankAccount" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" "BankAccountType" NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"openingBalance" numeric(14, 2) DEFAULT '0' NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS "LedgerEntry" (
	"id" text PRIMARY KEY NOT NULL,
	"date" timestamp(3) NOT NULL,
	"accountId" text NOT NULL,
	"bankAccountId" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"sourceType" "LedgerSourceType" NOT NULL,
	"sourceId" text,
	"description" text,
	"notes" text,
	"createdById" integer,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS "Contractor" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"businessName" text,
	"taxClassification" text,
	"status" "ContractorStatus" DEFAULT 'ACTIVE' NOT NULL,
	"w9Status" "W9Status" DEFAULT 'PENDING' NOT NULL,
	"notes" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS "W9Submission" (
	"id" text PRIMARY KEY NOT NULL,
	"contractorId" text NOT NULL,
	"contractId" text,
	"taxIdLast4" text,
	"submittedAt" timestamp(3),
	"verifiedById" integer,
	"verifiedAt" timestamp(3),
	"expiresAt" timestamp(3),
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS "ContractorPayment" (
	"id" text PRIMARY KEY NOT NULL,
	"contractorId" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"date" timestamp(3) NOT NULL,
	"method" text,
	"notes" text,
	"createdById" integer,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS "ExpenseCategory" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS "Expense" (
	"id" text PRIMARY KEY NOT NULL,
	"submittedById" integer NOT NULL,
	"categoryId" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"dateIncurred" timestamp(3) NOT NULL,
	"description" text,
	"isReimbursable" boolean DEFAULT true NOT NULL,
	"status" "ExpenseStatus" DEFAULT 'SUBMITTED' NOT NULL,
	"receiptS3Key" text,
	"receiptFileName" text,
	"approvedById" integer,
	"approvedAt" timestamp(3),
	"rejectionReason" text,
	"reimbursedAt" timestamp(3),
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS "FinancialGoal" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"metricType" "GoalMetricType" NOT NULL,
	"targetAmount" numeric(14, 2) NOT NULL,
	"period" "GoalPeriod" NOT NULL,
	"startDate" timestamp(3) NOT NULL,
	"endDate" timestamp(3) NOT NULL,
	"createdById" integer,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);

-- ── Indexes ──────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS "LedgerAccount_code_key" ON "LedgerAccount" USING btree ("code");
CREATE INDEX IF NOT EXISTS "LedgerAccount_type_idx" ON "LedgerAccount" USING btree ("type");
CREATE INDEX IF NOT EXISTS "LedgerAccount_parentId_idx" ON "LedgerAccount" USING btree ("parentId");
CREATE INDEX IF NOT EXISTS "BankAccount_isActive_idx" ON "BankAccount" USING btree ("isActive");
CREATE INDEX IF NOT EXISTS "LedgerEntry_date_idx" ON "LedgerEntry" USING btree ("date");
CREATE INDEX IF NOT EXISTS "LedgerEntry_accountId_idx" ON "LedgerEntry" USING btree ("accountId");
CREATE INDEX IF NOT EXISTS "LedgerEntry_bankAccountId_idx" ON "LedgerEntry" USING btree ("bankAccountId");
CREATE INDEX IF NOT EXISTS "LedgerEntry_sourceType_sourceId_idx" ON "LedgerEntry" USING btree ("sourceType", "sourceId");
CREATE UNIQUE INDEX IF NOT EXISTS "Contractor_email_key" ON "Contractor" USING btree ("email");
CREATE INDEX IF NOT EXISTS "Contractor_status_idx" ON "Contractor" USING btree ("status");
CREATE INDEX IF NOT EXISTS "Contractor_w9Status_idx" ON "Contractor" USING btree ("w9Status");
CREATE UNIQUE INDEX IF NOT EXISTS "W9Submission_contractorId_key" ON "W9Submission" USING btree ("contractorId");
CREATE UNIQUE INDEX IF NOT EXISTS "W9Submission_contractId_key" ON "W9Submission" USING btree ("contractId");
CREATE INDEX IF NOT EXISTS "ContractorPayment_contractorId_idx" ON "ContractorPayment" USING btree ("contractorId");
CREATE INDEX IF NOT EXISTS "ContractorPayment_date_idx" ON "ContractorPayment" USING btree ("date");
CREATE UNIQUE INDEX IF NOT EXISTS "ExpenseCategory_name_key" ON "ExpenseCategory" USING btree ("name");
CREATE INDEX IF NOT EXISTS "Expense_submittedById_idx" ON "Expense" USING btree ("submittedById");
CREATE INDEX IF NOT EXISTS "Expense_status_idx" ON "Expense" USING btree ("status");
CREATE INDEX IF NOT EXISTS "Expense_categoryId_idx" ON "Expense" USING btree ("categoryId");
CREATE INDEX IF NOT EXISTS "FinancialGoal_period_idx" ON "FinancialGoal" USING btree ("period");
CREATE INDEX IF NOT EXISTS "FinancialGoal_startDate_endDate_idx" ON "FinancialGoal" USING btree ("startDate", "endDate");

-- ── Foreign keys ─────────────────────────────────────────────────────────
DO $$ BEGIN ALTER TABLE "LedgerAccount" ADD CONSTRAINT "LedgerAccount_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "LedgerAccount"("id") ON DELETE set null ON UPDATE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "LedgerAccount"("id") ON DELETE restrict ON UPDATE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE restrict ON UPDATE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE set null ON UPDATE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "W9Submission" ADD CONSTRAINT "W9Submission_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE cascade ON UPDATE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "W9Submission" ADD CONSTRAINT "W9Submission_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE set null ON UPDATE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "W9Submission" ADD CONSTRAINT "W9Submission_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE set null ON UPDATE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "ContractorPayment" ADD CONSTRAINT "ContractorPayment_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE restrict ON UPDATE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "ContractorPayment" ADD CONSTRAINT "ContractorPayment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE set null ON UPDATE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "Expense" ADD CONSTRAINT "Expense_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE restrict ON UPDATE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "Expense" ADD CONSTRAINT "Expense_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE set null ON UPDATE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "Expense" ADD CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE restrict ON UPDATE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "FinancialGoal" ADD CONSTRAINT "FinancialGoal_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE set null ON UPDATE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
