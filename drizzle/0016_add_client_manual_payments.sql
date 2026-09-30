-- Financials 2 / Client Payments: manual (non-Stripe) client payments —
-- cash, check, Zelle, wire. Mirrors src/lib/db/schema.ts. Idempotent: safe to re-run.

DO $$ BEGIN CREATE TYPE "ManualPaymentMethod" AS ENUM ('CASH', 'CHECK', 'ZELLE', 'WIRE', 'OTHER'); EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "ClientManualPayment" (
	"id" text PRIMARY KEY NOT NULL,
	"clientId" text NOT NULL,
	"invoiceId" text,
	"amount" integer NOT NULL,
	"method" "ManualPaymentMethod" NOT NULL,
	"receivedAt" timestamp(3) NOT NULL,
	"reference" text,
	"notes" text,
	"createdById" integer,
	"voidedAt" timestamp(3),
	"voidedById" integer,
	"voidReason" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);

CREATE INDEX IF NOT EXISTS "ClientManualPayment_receivedAt_idx" ON "ClientManualPayment" USING btree ("receivedAt");
CREATE INDEX IF NOT EXISTS "ClientManualPayment_clientId_idx" ON "ClientManualPayment" USING btree ("clientId");
CREATE INDEX IF NOT EXISTS "ClientManualPayment_invoiceId_idx" ON "ClientManualPayment" USING btree ("invoiceId");

DO $$ BEGIN ALTER TABLE "ClientManualPayment" ADD CONSTRAINT "ClientManualPayment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE restrict ON UPDATE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "ClientManualPayment" ADD CONSTRAINT "ClientManualPayment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE set null ON UPDATE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "ClientManualPayment" ADD CONSTRAINT "ClientManualPayment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE set null ON UPDATE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "ClientManualPayment" ADD CONSTRAINT "ClientManualPayment_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "User"("id") ON DELETE set null ON UPDATE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
