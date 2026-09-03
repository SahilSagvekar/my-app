DO $$ BEGIN
  CREATE TYPE "ClientExpenseStatus" AS ENUM ('PENDING', 'INVOICED', 'PAID');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ExpenseTrip" (
  "id" text PRIMARY KEY NOT NULL,
  "clientId" text NOT NULL REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "name" text NOT NULL,
  "createdById" integer NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" timestamp(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS "ClientExpense" (
  "id" text PRIMARY KEY NOT NULL,
  "tripId" text NOT NULL REFERENCES "ExpenseTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "description" text NOT NULL,
  "amount" integer NOT NULL,
  "expenseDate" timestamp(3) NOT NULL,
  "receiptS3Key" text NOT NULL,
  "receiptUrl" text NOT NULL,
  "receiptFileName" text NOT NULL,
  "status" "ClientExpenseStatus" DEFAULT 'PENDING' NOT NULL,
  "invoiceId" text REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "createdById" integer NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" timestamp(3) NOT NULL
);

CREATE INDEX IF NOT EXISTS "ExpenseTrip_clientId_idx" ON "ExpenseTrip" ("clientId");
CREATE INDEX IF NOT EXISTS "ClientExpense_tripId_idx" ON "ClientExpense" ("tripId");
CREATE INDEX IF NOT EXISTS "ClientExpense_invoiceId_idx" ON "ClientExpense" ("invoiceId");
