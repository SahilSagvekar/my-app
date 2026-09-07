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
  "updatedAt" timestamp(3) NOT NULL
);

CREATE UNIQUE INDEX "MediaPreview_s3Key_key" ON "MediaPreview" USING btree ("s3Key");
CREATE INDEX "MediaPreview_previewS3Key_idx" ON "MediaPreview" USING btree ("previewS3Key");
CREATE INDEX "MediaPreview_fileId_idx" ON "MediaPreview" USING btree ("fileId");
CREATE INDEX "MediaPreview_taskId_idx" ON "MediaPreview" USING btree ("taskId");
CREATE INDEX "MediaPreview_status_idx" ON "MediaPreview" USING btree ("status");
