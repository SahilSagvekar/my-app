-- Adds mandatory-recipient sharing: ShareableFile links now require at least
-- one ShareRecipient row (enforced in application code at
-- POST /api/drive/share) rather than being accessible to anyone with the URL.

CREATE TABLE "ShareRecipient" (
	"id" text PRIMARY KEY NOT NULL,
	"shareId" text NOT NULL,
	"email" text NOT NULL,
	"status" text DEFAULT 'invited' NOT NULL,
	"otpCode" text,
	"otpExpiresAt" timestamp(3),
	"lastAccessedAt" timestamp(3),
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE INDEX "ShareRecipient_shareId_idx" ON "ShareRecipient" USING btree ("shareId" text_ops);
--> statement-breakpoint
CREATE UNIQUE INDEX "ShareRecipient_shareId_email_key" ON "ShareRecipient" USING btree ("shareId" text_ops,"email" text_ops);